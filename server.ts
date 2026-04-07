import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Supabase Admin Client ---
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- Yandex OAuth Config ---
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID!;
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET!;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const YANDEX_REDIRECT_URI = `${APP_URL}/api/auth/yandex/callback`;

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Step 1: Redirect user to Yandex ---
app.get("/api/auth/yandex", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: YANDEX_CLIENT_ID,
    redirect_uri: YANDEX_REDIRECT_URI,
    force_confirm: "no",
  });
  res.redirect(`https://oauth.yandex.ru/authorize?${params.toString()}`);
});

// --- Step 2: Yandex redirects back here with ?code= ---
app.get("/api/auth/yandex/callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.redirect(`${APP_URL}/?auth_error=no_code`);
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
        redirect_uri: YANDEX_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Yandex token error:", errText);
      return res.redirect(`${APP_URL}/?auth_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Fetch Yandex user info
    const userRes = await fetch("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!userRes.ok) {
      return res.redirect(`${APP_URL}/?auth_error=user_info_failed`);
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
    const existingUser = existingUsers?.users?.find(
      (u) => u.user_metadata?.yandex_id === yandexId
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
        return res.redirect(`${APP_URL}/?auth_error=user_creation_failed`);
      }

      supabaseUserId = newUser.user.id;
    }

    // Generate a one-time magic link to get a session on the client
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: APP_URL,
      },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Failed to generate magic link:", linkError);
      return res.redirect(`${APP_URL}/?auth_error=link_failed`);
    }

    // Redirect user to the Supabase magic link URL — it will set the session in the browser
    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(APP_URL)}`;
    return res.redirect(confirmUrl);

  } catch (err) {
    console.error("Yandex OAuth callback error:", err);
    return res.redirect(`${APP_URL}/?auth_error=server_error`);
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
