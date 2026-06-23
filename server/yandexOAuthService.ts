import type { Request } from "express";
import type { BackendUser } from "./auth";
import { newUserId } from "./auth";
import { runtimeConfig } from "./config";
import { transaction } from "./db";
import { createProfileForUser } from "./profileRepository";

const base = (value: string): string => value.replace(/\/+$/, "");
const read = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const yandexPasswordHash = "oauth$yandex";

type UserRow = { id: string; email: string; full_name: string | null; password_reset_required: boolean };
type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type YandexProfile = {
  id?: string;
  default_email?: string;
  emails?: string[];
  display_name?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
};

export function appAuthRedirect(params: Record<string, string>): string {
  const target = new URL(base(runtimeConfig.appUrl));
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  return target.toString();
}

export function yandexCallbackUrl(req: Request): string {
  const proto = read(req.headers["x-forwarded-proto"]) || req.protocol || "https";
  const apiUrl = runtimeConfig.apiUrl || `${proto}://${req.get("host")}`;
  return `${base(apiUrl)}/api/auth/yandex/callback`;
}

export function assertYandexOAuthConfigured(): void {
  if (!runtimeConfig.yandexClientId || !runtimeConfig.yandexClientSecret) {
    throw new Error("Yandex OAuth is not configured");
  }
}

function emailOf(profile: YandexProfile): string {
  const email = read(profile.default_email) || (Array.isArray(profile.emails) ? read(profile.emails[0]) : "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Yandex account did not return an email");
  return email.toLowerCase();
}

function nameOf(profile: YandexProfile, email: string): string {
  const parts = [profile.first_name, profile.last_name].map(read).filter(Boolean).join(" ");
  return (read(profile.display_name) || read(profile.real_name) || parts || email.split("@")[0] || "Пользователь").slice(0, 80);
}

function toUser(row: UserRow, fallbackName?: string): BackendUser {
  return { id: row.id, email: row.email, name: row.full_name || fallbackName || undefined, passwordResetRequired: row.password_reset_required };
}

async function exchangeCode(req: Request, code: string): Promise<string> {
  assertYandexOAuthConfigured();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: runtimeConfig.yandexClientId!,
    client_secret: runtimeConfig.yandexClientSecret!,
    redirect_uri: yandexCallbackUrl(req),
  });
  const response = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = await response.json().catch(() => null) as TokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Yandex token exchange failed: ${response.status}`);
  }
  return data.access_token;
}

async function loadProfile(accessToken: string): Promise<YandexProfile> {
  const response = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${accessToken}`, Accept: "application/json" },
  });
  const data = await response.json().catch(() => null) as YandexProfile | null;
  if (!response.ok || !data?.id) throw new Error(`Yandex profile load failed: ${response.status}`);
  return data;
}

async function upsertUser(profile: YandexProfile): Promise<BackendUser> {
  const yandexId = read(profile.id);
  const email = emailOf(profile);
  const name = nameOf(profile, email);
  if (!yandexId) throw new Error("Yandex account did not return an id");

  return transaction(async (client) => {
    const existing = await client.query<UserRow>("select id, email, full_name, password_reset_required from app_users where yandex_id = $1 or lower(email) = lower($2) order by case when yandex_id = $1 then 0 else 1 end limit 1", [yandexId, email]);
    if (existing.rows[0]) {
      await client.query("update app_users set provider = 'yandex', yandex_id = coalesce(yandex_id, $2), full_name = coalesce(full_name, nullif($3, '')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1", [existing.rows[0].id, yandexId, name]);
      await client.query("insert into profiles (id, username) values ($1, $2) on conflict (id) do nothing", [existing.rows[0].id, name]);
      return toUser(existing.rows[0], name);
    }

    const id = newUserId();
    const created = await client.query<UserRow>("insert into app_users (id, email, password_hash, full_name, provider, yandex_id, email_confirmed_at) values ($1, $2, $3, $4, 'yandex', $5, now()) returning id, email, full_name, password_reset_required", [id, email, yandexPasswordHash, name, yandexId]);
    await createProfileForUser(client, id, name);
    return toUser(created.rows[0], name);
  });
}

export async function finishYandexOAuth(req: Request, code: string): Promise<BackendUser> {
  const accessToken = await exchangeCode(req, code);
  const profile = await loadProfile(accessToken);
  return upsertUser(profile);
}
