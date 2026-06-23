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

dotenv.config();

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/payments/prodamus", paymentRouter);
app.use("/api/family", familyRouter);
app.use("/api/mentor", mentorRouter);

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    error: "Not found",
  });
});

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
