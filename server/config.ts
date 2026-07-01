type RuntimeEnv = "development" | "test" | "production";

const DEFAULT_PORT = 8080;
const PLACEHOLDER_VALUES = new Set([
  "app_url",
  "api_url",
  "yc_api_public_url",
  "prodamus_app_url",
  "prodamus_public_app_url",
  "prodamus_notification_app_url",
  "prodamus_payform_host",
  "payform_host",
  "your-domain",
  "example.com",
]);

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
  return PLACEHOLDER_VALUES.has(normalized) || normalized.includes("ann-word.vercel.app");
}

export function readPublicUrlEnv(name: string): string | undefined {
  const value = readOptionalEnv(name);
  if (!value || isPlaceholder(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return value.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export function readPublicHostEnv(name: string): string | undefined {
  const value = readOptionalEnv(name);
  if (!value || isPlaceholder(value)) return undefined;
  return value.replace(/\/+$/, "");
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

const defaultAppUrl = (env: RuntimeEnv): string => env === "production" ? "https://annword.ru" : "http://localhost:3000";
const defaultApiUrl = (env: RuntimeEnv): string | undefined => env === "production" ? "https://api.annword.ru" : undefined;
const runtimeEnv = readRuntimeEnv();

export const runtimeConfig = {
  env: runtimeEnv,
  port: readPort(),
  appUrl: readPublicUrlEnv("APP_URL") || defaultAppUrl(runtimeEnv),
  apiUrl: readPublicUrlEnv("API_URL") || readPublicUrlEnv("YC_API_PUBLIC_URL") || defaultApiUrl(runtimeEnv),
  databaseUrl: readDatabaseUrl(),
  yandexClientId: readOptionalEnv("YANDEX_CLIENT_ID"),
  yandexClientSecret: readOptionalEnv("YANDEX_CLIENT_SECRET"),
  prodamusSecret: readOptionalEnv("PRODAMUS_SECRET"),
  s3Endpoint: readOptionalEnv("S3_ENDPOINT"),
  s3FrontendBucket: readOptionalEnv("S3_FRONTEND_BUCKET"),
  s3AssetsBucket: readOptionalEnv("S3_ASSETS_BUCKET"),
};

export type RuntimeConfig = typeof runtimeConfig;
