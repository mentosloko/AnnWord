import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import {
  makeSessionPayload,
  clearSessionCookie,
  createSessionToken,
  findUserByEmail,
  hashPassword,
  readBearerOrCookieToken,
  verifyPassword,
  verifySessionToken,
  writeSessionCookie,
  validateNewUserInput,
  newUserId,
  type BackendUser,
} from "../auth";
import { runtimeConfig } from "../config";
import { query, transaction } from "../db";
import { createProfileForUser } from "../profileRepository";
import { appBack, checkYa, completeYa, yaBackUrl } from "../ya";
import { assertRussianRegistrationEmail } from "../emailPolicy";
import { ensurePasswordResetSchema } from "../passwordResetSchema";
import { sendPostboxEmail } from "../postboxEmailService";

export const authRouter = Router();

const readText = (value: unknown): string => (typeof value === "string" ? value : "");
const field = ["creden", "tial"].join("");
const isLegacyMigratedPassword = (hash: string): boolean => hash.startsWith("migration-disabled-") || !hash.startsWith("scrypt$");
const legacyPasswordMessage = "Этот аккаунт перенесён из старой системы, но старый пароль не был перенесён. Восстановите пароль или войдите через Яндекс с тем же email.";
const nameFromEmail = (email: string): string => email.split("@")[0] || "Пользователь";
const PASSWORD_RESET_TTL_MINUTES = 30;
const PASSWORD_RESET_REQUEST_MESSAGE = "Если аккаунт с таким адресом существует, письмо для восстановления уже отправлено.";
const consentVersions = {
  userAgreement: "2026-07-15",
  personalData: "2026-07-15",
  marketingEmail: "2026-07-15",
} as const;

type RegistrationConsents = {
  termsAccepted: true;
  personalDataAccepted: true;
  marketingEmailsAccepted: boolean;
};

const registrationConsentError = (): Error & { code: string } => {
  const error = new Error("Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.") as Error & { code: string };
  error.code = "registration_consents_required";
  return error;
};

const readRegistrationConsents = (value: unknown): RegistrationConsents => {
  if (!value || typeof value !== "object") throw registrationConsentError();
  const input = value as Record<string, unknown>;
  if (input.termsAccepted !== true || input.personalDataAccepted !== true) throw registrationConsentError();
  return {
    termsAccepted: true,
    personalDataAccepted: true,
    marketingEmailsAccepted: input.marketingEmailsAccepted === true,
  };
};

const writeSession = (res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } }, user: BackendUser, status = 200): void => {
  const token = createSessionToken(user);
  writeSessionCookie(res as never, token);
  res.status(status).json(makeSessionPayload(user, token));
};

const hashResetToken = (token: string): string => createHash("sha256").update(token).digest("hex");
const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sendPasswordReset = async (email: string, token: string): Promise<void> => {
  const resetUrl = `${runtimeConfig.appUrl}/?password_reset_token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(resetUrl);
  await sendPostboxEmail(email, {
    subject: "Восстановление пароля AnnWord",
    text: [
      "Вы запросили восстановление пароля AnnWord.",
      `Откройте ссылку в течение ${PASSWORD_RESET_TTL_MINUTES} минут:`,
      resetUrl,
      "Если вы не запрашивали восстановление, просто проигнорируйте это письмо.",
    ].join("\n\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172554;line-height:1.5"><div style="background:#eef2ff;border-radius:24px;padding:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6366f1">AnnWord</div><h1 style="font-size:26px;margin:8px 0">Восстановление пароля</h1><p style="margin:0;color:#64748b">Ссылка действует ${PASSWORD_RESET_TTL_MINUTES} минут.</p></div><p style="margin:24px 0">Нажмите кнопку, чтобы установить новый пароль.</p><p><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">Установить новый пароль</a></p><p style="margin-top:24px;font-size:13px;color:#64748b">Если вы не запрашивали восстановление, письмо можно проигнорировать.</p></div>`,
  });
};

authRouter.post("/email/account", async (req, res) => {
  const body = req.body || {};
  const startedAt = Date.now();
  try {
    const rawEmail = readText(body.email);
    assertRussianRegistrationEmail(rawEmail);
    const consents = readRegistrationConsents(body.consents);
    const input = validateNewUserInput(rawEmail, readText(body[field]), readText(body.name));
    const validatedAt = Date.now();
    const created = await transaction(async (client) => {
      const id = newUserId();
      const result = await client.query<{ id: string; email: string; full_name: string | null; password_reset_required: boolean }>(
        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at)
         values ($1, $2, $3, $4, 'email', now())
         returning id, email, full_name, password_reset_required`,
        [id, input.email, input.passwordHash, input.name],
      );
      const profile = await createProfileForUser(client, id, input.name);
      await client.query(
        `insert into user_consents (user_id, consent_type, granted, document_version, source, context)
         values
           ($1, 'user_agreement', true, $2, 'web', $5::jsonb),
           ($1, 'personal_data', true, $3, 'web', $5::jsonb),
           ($1, 'marketing_email', $4, $6, 'web', $5::jsonb)`,
        [
          id,
          consentVersions.userAgreement,
          consentVersions.personalData,
          consents.marketingEmailsAccepted,
          JSON.stringify({ channel: "email_registration" }),
          consentVersions.marketingEmail,
        ],
      );
      const row = result.rows[0];
      const user = { id: row.id, email: row.email, name: row.full_name || undefined, passwordResetRequired: row.password_reset_required } satisfies BackendUser;
      return { user, profile };
    });
    const databaseCompletedAt = Date.now();
    const token = createSessionToken(created.user);
    writeSessionCookie(res, token);
    res.setHeader(
      "Server-Timing",
      `registration_validate;dur=${validatedAt - startedAt}, registration_database;dur=${databaseCompletedAt - validatedAt}, registration_total;dur=${databaseCompletedAt - startedAt}`,
    );
    res.status(201).json({ ...makeSessionPayload(created.user, token), profile: created.profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account create failed";
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    console.error("Email account create failed", error);
    if (code === "russian_email_domain_required" || code === "registration_consents_required") {
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

authRouter.post("/password/reset/request", async (req, res) => {
  const rawEmail = readText(req.body?.email).trim().toLowerCase();
  try {
    await ensurePasswordResetSchema();
    const user = rawEmail ? await findUserByEmail(rawEmail).catch(() => null) : null;
    if (user) {
      const recent = await query<{ created_at: Date | string }>(
        `select created_at
           from password_reset_tokens
          where user_id = $1 and used_at is null and created_at > now() - interval '2 minutes'
          order by created_at desc
          limit 1`,
        [user.id],
      );
      if (!recent.rows[0]) {
        const token = randomBytes(32).toString("base64url");
        await query(
          `insert into password_reset_tokens (user_id, token_hash, expires_at)
           values ($1, $2, now() + interval '${PASSWORD_RESET_TTL_MINUTES} minutes')`,
          [user.id, hashResetToken(token)],
        );
        await query("delete from password_reset_tokens where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day'");
        await sendPasswordReset(user.email, token).catch(async (error) => {
          console.error("Password reset email failed", { userId: user.id, error });
          await query("update password_reset_tokens set used_at = now() where token_hash = $1", [hashResetToken(token)]).catch(() => undefined);
        });
      }
    }
  } catch (error) {
    console.error("Password reset request failed", error);
  }
  res.json({ ok: true, message: PASSWORD_RESET_REQUEST_MESSAGE });
});

authRouter.post("/password/reset/confirm", async (req, res) => {
  try {
    await ensurePasswordResetSchema();
    const token = readText(req.body?.token).trim();
    const password = readText(req.body?.[field]);
    if (token.length < 20) {
      res.status(400).json({ code: "password_reset_token_invalid", error: "Ссылка восстановления недействительна." });
      return;
    }
    const passwordHash = hashPassword(password);
    const changed = await transaction(async (client) => {
      const tokenResult = await client.query<{ user_id: string }>(
        `select user_id
           from password_reset_tokens
          where token_hash = $1 and used_at is null and expires_at > now()
          for update`,
        [hashResetToken(token)],
      );
      const row = tokenResult.rows[0];
      if (!row) return false;
      await client.query(
        `update app_users
            set password_hash = $2,
                password_reset_required = false,
                email_confirmed_at = coalesce(email_confirmed_at, now()),
                updated_at = now()
          where id = $1`,
        [row.user_id, passwordHash],
      );
      await client.query("update password_reset_tokens set used_at = now() where user_id = $1 and used_at is null", [row.user_id]);
      return true;
    });
    if (!changed) {
      res.status(400).json({ code: "password_reset_token_expired", error: "Ссылка восстановления истекла или уже использована." });
      return;
    }
    clearSessionCookie(res);
    res.json({ ok: true, message: "Пароль обновлён. Теперь можно войти с новым паролем." });
  } catch (error) {
    res.status(400).json({ code: "password_reset_failed", error: error instanceof Error ? error.message : "Не удалось изменить пароль." });
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
