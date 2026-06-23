import { Router } from "express";
import type { Request } from "express";
import { runtimeConfig } from "../config";

export const yandexOAuthRouter = Router();

const base = (value: string): string => value.replace(/\/+$/, "");
const read = (value: unknown): string => typeof value === "string" ? value.trim() : "";

function callbackUrl(req: Request): string {
  const apiUrl = runtimeConfig.apiUrl || `${read(req.headers["x-forwarded-proto"]) || req.protocol}://${req.get("host")}`;
  return `${base(apiUrl)}/api/auth/yandex/callback`;
}

yandexOAuthRouter.get("/yandex", (req, res) => {
  if (!runtimeConfig.yandexClientId || !runtimeConfig.yandexClientSecret) {
    res.status(503).json({ error: "Yandex OAuth is not configured" });
    return;
  }

  const redirect = new URL("https://oauth.yandex.ru/authorize");
  redirect.searchParams.set("response_type", "code");
  redirect.searchParams.set("client_id", runtimeConfig.yandexClientId);
  redirect.searchParams.set("redirect_uri", callbackUrl(req));
  res.redirect(302, redirect.toString());
});

yandexOAuthRouter.get("/yandex/callback", (_req, res) => {
  res.redirect(302, `${base(runtimeConfig.appUrl)}?auth_error=yandex_callback_not_ready`);
});
