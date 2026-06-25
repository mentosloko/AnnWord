import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { checkDatabaseHealth, closeDatabasePool } from "./db";
import { runtimeConfig } from "./config";
import { authRouter } from "./routes/authRoutes";
import { profileRouter } from "./routes/profileRoutes";
import { paymentRouter } from "./routes/paymentRoutes";
import { familyRouter } from "./routes/familyRoutes";
import { mentorRouter } from "./routes/mentorRoutes";
import { dailyQuestRouter } from "./routes/dailyQuestRoutes";
import { analyticsRouter } from "./routes/analyticsRoutes";
import { gameEventRouter } from "./routes/gameEventRoutes";
import { migrationRouter } from "./routes/migrationRoutes";
import { migrationSchemaRouter } from "./routes/migrationSchemaRoutes";

dotenv.config();

const app = express();
const distDir = path.join(process.cwd(), "dist");
const indexHtmlPath = path.join(distDir, "index.html");

const SESSION_COOKIE_PREFIX = "annword_session=";
const rewriteSessionCookie = (cookie: string): string => {
  if (!cookie.startsWith(SESSION_COOKIE_PREFIX) || process.env.NODE_ENV !== "production") return cookie;
  const withoutSameSite = cookie.replace(/;\s*SameSite=(Lax|Strict|None)/i, "");
  const withSecure = /;\s*Secure/i.test(withoutSameSite) ? withoutSameSite : `${withoutSameSite}; Secure`;
  return `${withSecure}; SameSite=None`;
};
const isYandexOAuthCallback = (req: Request): boolean => {
  const originalPath = (req.originalUrl || req.url || "").split("?")[0];
  return originalPath === "/api/auth/yandex/callback";
};
const rewriteFrontendRedirectToApiOrigin = (location: string): string => {
  if (!runtimeConfig.apiUrl) return location;
  try {
    const target = new URL(location);
    const apiOrigin = new URL(runtimeConfig.apiUrl);
    target.protocol = apiOrigin.protocol;
    target.host = apiOrigin.host;
    return target.toString();
  } catch {
    return location;
  }
};

app.disable("x-powered-by");
app.use((req, res, next) => {
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = ((name: string, value: number | string | readonly string[]) => {
    if (typeof name === "string" && name.toLowerCase() === "set-cookie") {
      if (Array.isArray(value)) return originalSetHeader(name, value.map(rewriteSessionCookie));
      if (typeof value === "string") return originalSetHeader(name, rewriteSessionCookie(value));
    }
    if (typeof name === "string" && name.toLowerCase() === "location" && typeof value === "string" && isYandexOAuthCallback(req)) {
      const rewritten = rewriteFrontendRedirectToApiOrigin(value);
      console.log("Yandex OAuth callback redirect", { toApiOrigin: rewritten !== value });
      return originalSetHeader(name, rewritten);
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
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = new Set(
        [runtimeConfig.appUrl, runtimeConfig.apiUrl, process.env.CORS_ORIGIN]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.replace(/\/$/, "")),
      );

      const normalizedOrigin = origin.replace(/\/$/, "");
      callback(null, allowedOrigins.size === 0 || allowedOrigins.has(normalizedOrigin));
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
  });
});

app.get("/api/payments/prodamus/notify", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});
app.head("/api/payments/prodamus/notify", (_req: Request, res: Response) => {
  res.status(200).end();
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/payments/prodamus", paymentRouter);
app.use("/api/family", familyRouter);
app.use("/api/mentor", mentorRouter);
app.use("/api/daily-quest", dailyQuestRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/game-events", gameEventRouter);
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

const server = app.listen(runtimeConfig.port, "0.0.0.0", () => {
  console.log(`AnnWord API listening on 0.0.0.0:${runtimeConfig.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down AnnWord API...`);

  server.close(async () => {
    await closeDatabasePool();
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});