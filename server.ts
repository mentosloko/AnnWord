import express, { Request } from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createClient, User } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Supabase Admin Client ---
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const normalizeAppUrl = (value: string | undefined): string => {
  const fallback = `http://localhost:${PORT}`;
  const raw = (value || fallback).trim().replace(/\/+$/, '');
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const firstHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const getRequestAppUrl = (req: Request): string => {
  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
  const rawHost = forwardedHost || req.get('host');
  if (!rawHost) return APP_URL;

  const host = rawHost.split(',')[0].trim();
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']);
  const rawProto = forwardedProto || req.protocol || (host.includes('localhost') ? 'http' : 'https');
  const proto = rawProto.split(',')[0].trim() || 'https';

  return normalizeAppUrl(`${proto}://${host}`);
};

const getYandexRedirectUri = (appUrl: string): string => `${appUrl}/api/auth/yandex/callback`;

// --- Yandex OAuth Config ---
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID!;
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET!;
const APP_URL = normalizeAppUrl(process.env.APP_URL);

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Step 1: Redirect user to Yandex ---
app.get("/api/auth/yandex", (req, res) => {
  const appUrl = getRequestAppUrl(req);
  const yandexRedirectUri = getYandexRedirectUri(appUrl);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: YANDEX_CLIENT_ID,
    redirect_uri: yandexRedirectUri,
    force_confirm: "no",
  });
  res.redirect(`https://oauth.yandex.ru/authorize?${params.toString()}`);
});

// --- Step 2: Yandex redirects back here with ?code= ---
app.get("/api/auth/yandex/callback", async (req, res) => {
  const appUrl = getRequestAppUrl(req);
  const yandexRedirectUri = getYandexRedirectUri(appUrl);
  const code = req.query.code as string;

  if (!code) {
    return res.redirect(`${appUrl}/?auth_error=no_code`);
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: YANDEX_CLIENT_ID,
        client_secret: YANDEX_CLIENT_SECRET,
        redirect_uri: yandexRedirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Yandex token error:", errText);
      return res.redirect(`${appUrl}/?auth_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Fetch Yandex user info
    const userRes = await fetch("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!userRes.ok) {
      return res.redirect(`${appUrl}/?auth_error=user_info_failed`);
    }

    const yandexUser = await userRes.json() as {
      id: string;
      login: string;
      real_name?: string;
      display_name?: string;
      default_email?: string;
      emails?: string[];
    };

    const yandexId = yandexUser.id;
    const email = yandexUser.default_email || yandexUser.emails?.[0] || `${yandexUser.login}@yandex.ru`;
    const displayName = yandexUser.real_name || yandexUser.display_name || yandexUser.login;

    // Find or create Supabase user by yandex_id stored in user_metadata
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser: User | undefined = existingUsers.users.find(
      (user: User) => user.user_metadata?.yandex_id === yandexId
    );

    let supabaseUserId: string;

    if (existingUser) {
      supabaseUserId = existingUser.id;
    } else {
      // Create a new Supabase user — no password required
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          yandex_id: yandexId,
          full_name: displayName,
          provider: "yandex",
        },
      });

      if (createError || !newUser?.user) {
        console.error("Failed to create Supabase user:", createError);
        return res.redirect(`${appUrl}/?auth_error=user_creation_failed`);
      }

      supabaseUserId = newUser.user.id;
    }

    // Generate a magic link — use action_link directly (includes token + type + redirect_to)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: appUrl,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Failed to generate magic link:", linkError);
      return res.redirect(`${appUrl}/?auth_error=link_failed`);
    }

    // action_link is the complete Supabase verify URL — redirect user directly to it
    return res.redirect(linkData.properties.action_link);

  } catch (err) {
    console.error("Yandex OAuth callback error:", err);
    return res.redirect(`${appUrl}/?auth_error=server_error`);
  }
});

// Vite middleware setup
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      let template = await vite.transformIndexHtml(url, `
        <html>
          <head><title>AnnWord</title></head>
          <body><div id="root"></div><script type="module" src="/index.tsx"></script></body>
        </html>
      `);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
