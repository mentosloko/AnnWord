const requiredForDeploy = [
  "YC_CLOUD_ID",
  "YC_FOLDER_ID",
  "YC_SERVICE_ACCOUNT_ID",
  "YC_REGISTRY_ID",
  "YC_SERVERLESS_CONTAINER_ID",
  "DATABASE_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_ENDPOINT",
  "S3_FRONTEND_BUCKET",
  "S3_ASSETS_BUCKET",
  "APP_URL",
] as const;

const optionalRuntime = [
  "SESSION_SECRET",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "PRODAMUS_SECRET",
  "YANDEX_CLIENT_ID",
  "YANDEX_CLIENT_SECRET",
  "API_URL",
  "YC_API_PUBLIC_URL",
] as const;

function isPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["0", "CHANGE_ME", "TEMP_REPLACE_ME"].includes(value.trim());
}

const missing = requiredForDeploy.filter((name) => !process.env[name]);
const missingApiUrl = !process.env.API_URL && !process.env.YC_API_PUBLIC_URL;
const placeholders = [...requiredForDeploy, ...optionalRuntime].filter((name) => isPlaceholder(process.env[name]));

if (process.env.CI === "true" && missing.length > 0) {
  console.error("Missing required Yandex deploy env variables:");
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

if (process.env.CI === "true" && missingApiUrl) {
  console.error("Missing required Yandex deploy env variables:");
  console.error("- API_URL or YC_API_PUBLIC_URL");
  process.exit(1);
}

if (process.env.CI === "true" && placeholders.length > 0) {
  console.error("Replace placeholder values before deploying:");
  for (const name of placeholders) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log("Yandex API deploy environment smoke check passed.");
