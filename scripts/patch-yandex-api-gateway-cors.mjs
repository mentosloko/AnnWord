import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/patch-yandex-api-gateway-cors.mjs <input-spec> <output-spec>");
}

const origins = (process.env.CORS_ALLOWED_ORIGINS ?? "https://annword.ru,https://www.annword.ru")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (origins.length === 0 || origins.some((origin) => !/^https:\/\/[a-z0-9.-]+$/i.test(origin))) {
  throw new Error("CORS_ALLOWED_ORIGINS must contain one or more absolute HTTPS origins.");
}

const serialized = readFileSync(inputPath, "utf8");
let source = serialized;

try {
  const envelope = JSON.parse(serialized);
  const openapiSpec = envelope.openapiSpec ?? envelope.openapi_spec;
  if (typeof openapiSpec === "string" && openapiSpec.trim()) {
    source = openapiSpec;
  }
} catch {
  // The CLI may already return the raw OpenAPI specification.
}

if (!/^\s*x-yc-apigateway:\s*$/m.test(source) || !/^\s*cors:\s*$/m.test(source)) {
  throw new Error("The API Gateway specification does not contain the expected x-yc-apigateway CORS block.");
}

const wildcardOrigin = /^([ \t]*)origin:\s*(?:'\*'|"\*"|\*)[ \t]*$/gm;
const matches = [...source.matchAll(wildcardOrigin)];

if (matches.length !== 1) {
  throw new Error(`Expected exactly one wildcard CORS origin, found ${matches.length}. Refusing to change the gateway.`);
}

const match = matches[0];
const indent = match[1];
const replacement = [
  `${indent}origin:`,
  ...origins.map((origin) => `${indent}  - ${origin}`),
].join("\n");

const patched = `${source.slice(0, match.index)}${replacement}${source.slice((match.index ?? 0) + match[0].length)}`;

if (patched === source || /(^|\n)[ \t]*origin:\s*(?:'\*'|"\*"|\*)[ \t]*(?=\n|$)/m.test(patched)) {
  throw new Error("The CORS patch did not remove the wildcard origin.");
}

writeFileSync(outputPath, patched);
console.log(JSON.stringify({ changed: true, origins }));
