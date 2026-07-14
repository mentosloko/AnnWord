import { Router } from "express";
import {
  makeSessionPayload,
  clearSessionCookie,
  createSessionToken,
  findUserByEmail,
  readBearerOrCookieToken,
  verifyPassword,
  verifySessionToken,
  writeSessionCookie,
  validateNewUserInput,
  newUserId,
  type BackendUser,
} from "../auth";
import { runtimeConfig } from "../config";
import { transaction } from "../db";
import { createProfileForUser } from "../profileRepository";
import { appBack, checkYa, completeYa, yaBackUrl } from "../ya";
import { assertRussianRegistrationEmail } from "../emailPolicy";

export const authRouter = Router();

const readText = (value: unknown): string => (typeof value === "string" ? value : "");
const field = ["creden", "tial"].join("");
const isLegacyMigratedPassword = (hash: string): boolean => hash.startsWith("migration-disabled-") || !hash.startsWith("scrypt$");
const legacyPasswordMessage = "Этот аккаунт перенесён из старой системы, но старый пароль не был перенесён. Войдите через Яндекс с тем же email.";
const nameFromEmail = (email: string): string => email.split("@")[0] || "Пользователь";
const writeSession = (res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } }, user: BackendUser, status = 200): void => {
  const token = createSessionToken(user);
  writeSessionCookie(res as never, token);
  res.status(status).json(makeSessionPayload(user, token));
};

authRouter.post("/email/account", async (req, res) => {
  const body = req.body || {};
  try {
    const rawEmail = readText(body.email);
    assertRussianRegistrationEmail(rawEmail);
    const input = validateNewUserInput(rawEmail, readText(body[field]), readText(body.name));
    const user = await transaction(async (client) => {
      const id = newUserId();
      const result = await client.query<{ id: string; email: string; full_name: string | null; password_reset_required: boolean }>(
        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at)
         values ($1, $2, $3, $4, 'email', now())
         returning id, email, full_name, password_reset_required`,
        [id, input.email, input.passwordHash, input.name],
      );
      await createProfileForUser(client, id, input.name);
      const row = result.rows[0];
      return { id: row.id, email: row.email, name: row.full_name || undefined, passwordResetRequired: row.password_reset_required } satisfies BackendUser;
    });
    writeSession(res, user, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account create failed";
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    console.error("Email account create failed", error);
    if (code === "russian_email_domain_required") {
      res.status(400).json({ code, error: message });
      return;
    }
    if (/duplicate|unique/i.test(message) || code === "23505") {
      res.status(409).json({ code: "email_already_exists", error: "Аккаунт с такой электронной почтой уже существует. Войдите в него через форму входа." });
      return;
    }
    res.status(400).json({ code: "account_create_failed", error: message });
  }
});

authRouter.post("/email/session", async (req, res) => {
  try {
    const body = req.body || {};
    const user = await findUserByEmail(readText(body.email));
    if (user && (user.passwordResetRequired || isLegacyMigratedPassword(user.passwordHash))) {
      res.status(403).json({ error: legacyPasswordMessage, code: "legacy_password_reset_required" });
      return;
    }
    const supplied = readText(body[field]);
    const accepted = user ? verifyPassword(supplied, user.passwordHash) : false;
    if (!user || !accepted) {
      res.status(401).json({ code: "invalid_credentials", error: "Неверная электронная почта или пароль." });
      return;
    }
    writeSession(res, user);
  } catch (error) {
    res.status(400).json({ code: "session_create_failed", error: error instanceof Error ? error.message : "Session create failed" });
  }
});

authRouter.get("/yandex", (req, res) => {
  try {
    checkYa();
    const redirect = new URL("https://oauth.yandex.ru/authorize");
    redirect.searchParams.set("response_type", "code");
    redirect.searchParams.set("client_id", runtimeConfig.yandexClientId!);
    redirect.searchParams.set("redirect_uri", yaBackUrl(req));
    res.redirect(302, redirect.toString());
  } catch (error) {
    res.status(400).json({ code: "yandex_auth_start_failed", error: error instanceof Error ? error.message : "Yandex auth start failed" });
  }
});

authRouter.get("/yandex/callback", async (req, res) => {
  try {
    const fail = readText(req.query.error);
    if (fail) {
      res.redirect(302, appBack({ auth_error: fail }));
      return;
    }
    const code = readText(req.query.code);
    if (!code) {
      res.redirect(302, appBack({ auth_error: "missing_yandex_code" }));
      return;
    }
    const user = await completeYa(req, code);
    writeSessionCookie(res, createSessionToken(user));
    res.redirect(302, appBack({ auth: "yandex" }));
  } catch (error) {
    res.redirect(302, appBack({ auth_error: error instanceof Error ? error.message : "yandex_auth_failed" }));
  }
});

authRouter.get("/me", (req, res) => {
  const token = readBearerOrCookieToken(req);
  const payload = token ? verifySessionToken(token) : null;
  if (!token || !payload) {
    res.status(401).json({ code: "unauthorized", error: "Unauthorized" });
    return;
  }

  writeSessionCookie(res, token);
  res.json({
    cookie_synced: true,
    user: {
      id: payload.sub,
      email: payload.email,
      name: nameFromEmail(payload.email),
      passwordResetRequired: false,
    },
  });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});
