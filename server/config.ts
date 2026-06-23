type RuntimeEnv = "development" | "test" | "production";

const DEFAULT_PORT = 8080;

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

export function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readPort(): number {
  const rawPort = readOptionalEnv("PORT");
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return parsedPort;
}

export function readRuntimeEnv(): RuntimeEnv {
  const value = readOptionalEnv("NODE_ENV");
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }

  return "development";
}

export function readDatabaseUrl(): string | undefined {
  const directUrl = readOptionalEnv("DATABASE_URL");
  if (directUrl) {
    return directUrl;
  }

  const host = readOptionalEnv("PGHOST");
  const port = readOptionalEnv("PGPORT") || "6432";
  const database = readOptionalEnv("PGDATABASE");
  const user = readOptionalEnv("PGUSER");
  const password = readOptionalEnv("PGPASSWORD");

  if (!host || !database || !user || !password) {
    return undefined;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}?sslmode=require`;
}

export const runtimeConfig = {
  env: readRuntimeEnv(),
  port: readPort(),
  appUrl: readOptionalEnv("APP_URL") || "http://localhost:3000",
  apiUrl: readOptionalEnv("API_URL") || readOptionalEnv("YC_API_PUBLIC_URL"),
  databaseUrl: readDatabaseUrl(),
  yandexClientId: readOptionalEnv("YANDEX_CLIENT_ID"),
  yandexClientSecret: readOptionalEnv("YANDEX_CLIENT_SECRET"),
  prodamusSecret: readOptionalEnv("PRODAMUS_SECRET"),
  s3Endpoint: readOptionalEnv("S3_ENDPOINT"),
  s3FrontendBucket: readOptionalEnv("S3_FRONTEND_BUCKET"),
  s3AssetsBucket: readOptionalEnv("S3_ASSETS_BUCKET"),
};

export type RuntimeConfig = typeof runtimeConfig;
