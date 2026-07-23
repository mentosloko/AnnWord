import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { checkDatabaseHealth, closeDatabasePool, query, transaction } from "./db";
import { runtimeConfig } from "./config";
import { ensureConsentSchema } from "./consentSchema";
import { ensureWeeklyReportSchema } from "./weeklyReportSchema";
import { createSessionToken, makeSessionPayload, writeSessionCookie, type BackendUser } from "./auth";
import { appBack, completeYa } from "./ya";
import { pendingEmailSessionRouter } from "./routes/pendingEmailSessionRoutes";
import { magicLinkRouter } from "./routes/magicLinkRoutes";
import { authRouter } from "./routes/authRoutes";
import { profileRouter } from "./routes/profileRoutes";
import { paymentRouter } from "./routes/paymentRoutes";
import { parentPinRecoveryRouter } from "./routes/parentPinRecoveryRoutes";
import { familyRouter } from "./routes/familyRoutes";
import { mentorRouter } from "./routes/mentorRoutes";
import { dailyQuestRouter } from "./routes/dailyQuestRoutes";
import { analyticsRouter } from "./routes/analyticsRoutes";
import { gameEventRouter } from "./routes/gameEventRoutes";
import { migrationRouter } from "./routes/migrationRoutes";
import { migrationSchemaRouter } from "./routes/migrationSchemaRoutes";
import { weeklyReportRouter } from "./routes/weeklyReportRoutes";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
let server: ReturnType<typeof app.listen> | null = null;
const distDir = path.join(process.cwd(), "dist");
const indexHtmlPath = path.join(distDir, "index.html");

const SESSION_COOKIE_PREFIX = "annword_session=";
const rewriteSessionCookie = (cookie: string): string => {
  if (!cookie.startsWith(SESSION_COOKIE_PREFIX) || process.env.NODE_ENV !== "production") return cookie;
  const withoutSameSite = cookie.replace(/;\s*SameSite=(Lax|Strict|None)/i, "");
  const withSecure = /;\s*Secure/i.test(withoutSameSite) ? withoutSameSite : `${withoutSameSite}; Secure`;
  return `${withSecure}; SameSite=None`;
};
const readText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const normalizeOrigin = (value: string): string => value.replace(/\/$/, "");
const addAllowedOrigin = (origins: Set<string>, value: unknown): void => {
  const normalized = normalizeOrigin(readText(value));
  if (!normalized) return;

  origins.add(normalized);

  try {
    const url = new URL(normalized);
    if (url.hostname === "annword.ru" || url.hostname === "www.annword.ru") {
      for (const protocol of ["https:", "http:"]) {
        for (const hostname of ["annword.ru", "www.annword.ru"]) {
          const sibling = new URL(url.toString());
          sibling.protocol = protocol;
          sibling.hostname = hostname;
          origins.add(normalizeOrigin(sibling.toString()));
        }
      }
    }
  } catch {
    // Ignore malformed optional CORS values and keep the explicitly normalized value above.
  }
};
const hashHandoff = (value: string): string => createHash("sha256").update(value).digest("hex");
const newHandoff = (): string => randomBytes(32).toString("base64url");

async function createYandexHandoff(user: BackendUser): Promise<string> {
  const code = newHandoff();
  await query(
    `insert into oauth_handoffs (code_hash, user_id, expires_at)
     values ($1, $2, now() + interval '5 minutes')`,
    [hashHandoff(code), user.id],
  );
  await query("delete from oauth_handoffs where expires_at < now() - interval '1 day' or consumed_at < now() - interval '1 day'");
  return code;
}

async function consumeYandexHandoff(code: string): Promise<BackendUser | null> {
  if (!code || code.length < 20) return null;
  return transaction(async (client) => {
    const result = await client.query<{
      code_hash: string;
      id: string;
      email: string;
      full_name: string | null;
      password_reset_required: boolean;
    }>(
      `select h.code_hash, u.id, u.email, u.full_name, u.password_reset_required
         from oauth_handoffs h
         join app_users u on u.id = h.user_id
        where h.code_hash = $1
          and h.consumed_at is null
          and h.expires_at > now()
        for update of h`,
      [hashHandoff(code)],
    );
    const row = result.rows[0];
    if (!row) return null;
    await client.query("update oauth_handoffs set consumed_at = now() where code_hash = $1", [row.code_hash]);
    return {
      id: row.id,
      email: row.email,
      name: row.full_name || undefined,
      passwordResetRequired: row.password_reset_required,
    } satisfies BackendUser;
  });
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = ((name: string, value: number | string | readonly string[]) => {
    if (typeof name === "string" && name.toLowerCase() === "set-cookie") {
      if (Array.isArray(value)) return originalSetHeader(name, value.map(rewriteSessionCookie));
      if (typeof value === "string") return originalSetHeader(name, rewriteSessionCookie(value));
    }
    return originalSetHeader(name, value);
  }) as typeof res.setHeader;
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use((req, _res, next) => {
  const appSession = req.headers["x-annword-session"];
  if (typeof appSession === "string" && appSession.trim() && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${appSession.trim()}`;
  }
  next();
});
app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = readText(req.headers["x-request-id"]) || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  let logged = false;
  const log = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO",
      message: "HTTP request completed",
      event: "http_request",
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      aborted,
      origin: readText(req.headers.origin) || null,
    }));
  };
  res.once("finish", () => log(false));
  res.once("close", () => log(!res.writableEnded));
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowedOrigins = new Set<string>();
      [runtimeConfig.appUrl, runtimeConfig.apiUrl, process.env.CORS_ORIGIN].forEach((value) => addAllowedOrigin(allowedOrigins, value));
      const normalizedOrigin = normalizeOrigin(origin);
      const isAnnWordVercel = /^https:\/\/ann-word(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(normalizedOrigin);
      const allowed = allowedOrigins.size === 0 || allowedOrigins.has(normalizedOrigin) || isAnnWordVercel;
      if (!allowed) console.warn(JSON.stringify({ level: "WARN", message: "CORS origin rejected", event: "cors_rejected", origin: normalizedOrigin }));
      callback(null, allowed);
    },
    credentials: true,
  }),
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "annword-api",
    runtime: "yandex-cloud",
    env: runtimeConfig.env,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/db", async (_req: Request, res: Response) => {
  const database = await checkDatabaseHealth();

  res.status(database.ok ? 200 : 503).json({
    status: database.ok ? "ok" : "error",
    service: "annword-api",
    database,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/runtime-config", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    appUrl: runtimeConfig.appUrl,
    apiUrl: runtimeConfig.apiUrl,
    hasDatabase: Boolean(runtimeConfig.databaseUrl),
    hasYandexOAuth: Boolean(runtimeConfig.yandexClientId && runtimeConfig.yandexClientSecret),
    hasProdamus: Boolean(runtimeConfig.prodamusSecret),
    hasObjectStorage: Boolean(runtimeConfig.s3Endpoint && runtimeConfig.s3FrontendBucket && runtimeConfig.s3AssetsBucket),
    hasWeeklyReports: Boolean(process.env.WEEKLY_REPORT_FROM_EMAIL && process.env.WEEKLY_REPORT_CRON_SECRET),
  });
});

app.get("/api/payments/prodamus/notify", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});
app.head("/api/payments/prodamus/notify", (_req: Request, res: Response) => {
  res.status(200).end();
});

app.get("/api/auth/yandex/callback", async (req: Request, res: Response) => {
  try {
    const fail = readText(req.query.error);
    if (fail) {
      res.redirect(302, appBack({ auth_error: fail }));
      return;
    }
    const yandexCode = readText(req.query.code);
    if (!yandexCode) {
      res.redirect(302, appBack({ auth_error: "missing_yandex_code" }));
      return;
    }
    const user = await completeYa(req, yandexCode);
    const appCode = await createYandexHandoff(user);
    console.log("Yandex OAuth handoff created", { userId: user.id });
    res.redirect(302, appBack({ auth: "yandex", oauth_code: appCode }));
  } catch (error) {
    console.error("Yandex OAuth callback failed", error);
    res.redirect(302, appBack({ auth_error: error instanceof Error ? error.message : "yandex_auth_failed" }));
  }
});

app.post("/api/auth/yandex/exchange", async (req: Request, res: Response) => {
  try {
    const user = await consumeYandexHandoff(readText((req.body || {}).code));
    if (!user) {
      res.status(401).json({ error: "Invalid or expired Yandex login code" });
      return;
    }
    const sessionToken = createSessionToken(user);
    writeSessionCookie(res, sessionToken);
    res.json(makeSessionPayload(user, sessionToken));
  } catch (error) {
    console.error("Yandex OAuth exchange failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Yandex exchange failed" });
  }
});

app.use("/api/auth", pendingEmailSessionRouter);
app.use("/api/auth", magicLinkRouter);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/payments/prodamus", paymentRouter);
app.use("/api/family", parentPinRecoveryRouter);
app.use("/api/family", familyRouter);
app.use("/api/mentor", mentorRouter);
app.use("/api/daily-quest", dailyQuestRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/game-events", gameEventRouter);
app.use("/api/reports/weekly", weeklyReportRouter);
app.use("/api/admin/migration", migrationSchemaRouter);
app.use("/api/admin/migration", migrationRouter);

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    error: "Not found",
  });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
    res.sendFile(indexHtmlPath);
  });
}

async function startServer(): Promise<void> {
  try {
    await ensureConsentSchema();
    await ensureWeeklyReportSchema();
    console.log("Runtime schemas are ready.");
    server = app.listen(runtimeConfig.port, "0.0.0.0", () => {
      console.log(`AnnWord API listening on 0.0.0.0:${runtimeConfig.port}`);
    });
  } catch (error) {
    console.error("AnnWord API startup failed while preparing runtime schemas", error);
    await closeDatabasePool().catch(() => undefined);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down AnnWord API...`);

  if (!server) {
    await closeDatabasePool().catch(() => undefined);
    process.exit(0);
  }

  server.close(async () => {
    await closeDatabasePool();
    process.exit(0);
  });
}

void startServer();

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
