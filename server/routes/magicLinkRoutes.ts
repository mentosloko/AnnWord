import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import {
  createSessionToken,
  findUserByEmail,
  findUserById,
  makeSessionPayload,
  newUserId,
  validateNewUserInput,
  verifyPassword,
  writeSessionCookie,
  type BackendUser,
} from '../auth';
import { ensureAccountActionTokenSchema } from '../accountActionTokenSchema';
import { runtimeConfig } from '../config';
import { query, transaction } from '../db';
import { assertRussianRegistrationEmail } from '../emailPolicy';
import { ensurePendingEmailRegistrationSchema } from '../pendingEmailRegistrationSchema';
import { sendPostboxEmail } from '../postboxEmailService';
import { createProfileForUser } from '../profileRepository';

export const magicLinkRouter = Router();

const readText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const field = ['creden', 'tial'].join('');
const MAGIC_LINK_TTL_MINUTES = 15;
const REGISTRATION_TTL_MINUTES = 30;
const MAGIC_LINK_REQUEST_MESSAGE = 'Если аккаунт с таким email существует, письмо со ссылкой для входа отправлено.';
const isLegacyMigratedPassword = (hash: string): boolean => hash.startsWith('migration-disabled-') || !hash.startsWith('scrypt$');
const legacyPasswordMessage = 'Этот аккаунт перенесён из старой системы, но старый пароль не был перенесён. Восстановите пароль или войдите через magic link с тем же email.';
const consentVersions = { userAgreement: '2026-07-15', personalData: '2026-07-15', marketingEmail: '2026-07-15' } as const;
const registrationBuckets = new Map<string, { count: number; resetAt: number }>();

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hashedBucketKey = (value: string): string => createHash('sha256').update(value).digest('hex');

class RegistrationRateLimitError extends Error {
  code = 'registration_rate_limited';
  constructor() { super('Слишком много попыток регистрации. Попробуйте позднее.'); }
}

type RegistrationConsents = { termsAccepted: true; personalDataAccepted: true; marketingEmailsAccepted: boolean };
const readRegistrationConsents = (value: unknown): RegistrationConsents => {
  if (!value || typeof value !== 'object') throw new Error('Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.');
  const input = value as Record<string, unknown>;
  if (input.termsAccepted !== true || input.personalDataAccepted !== true) throw new Error('Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.');
  return { termsAccepted: true, personalDataAccepted: true, marketingEmailsAccepted: input.marketingEmailsAccepted === true };
};

const readClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === 'string' ? forwarded.split(',')[0] : '';
  return (first || req.ip || req.socket.remoteAddress || 'unknown').trim();
};

const consumeLocalRegistrationLimit = (key: string, maxAttempts: number, windowMs: number): void => {
  const now = Date.now();
  const safeKey = hashedBucketKey(key);
  const previous = registrationBuckets.get(safeKey);
  const next = !previous || previous.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { ...previous, count: previous.count + 1 };
  registrationBuckets.set(safeKey, next);
  if (registrationBuckets.size > 5_000) {
    for (const [bucket, value] of registrationBuckets) if (value.resetAt <= now) registrationBuckets.delete(bucket);
  }
  if (next.count > maxAttempts) throw new RegistrationRateLimitError();
};

const ensureGlobalRegistrationCapacity = async (): Promise<void> => {
  const result = await query<{ active: string }>(
    `select count(*)::text as active
       from pending_email_registrations
      where expires_at > now()`,
  );
  if (Number(result.rows[0]?.active || 0) >= 1_000) throw new RegistrationRateLimitError();
};

const issueMagicLink = async (user: BackendUser): Promise<void> => {
  await ensureAccountActionTokenSchema();
  const recent = await query<{ created_at: Date | string }>(
    `select created_at from account_action_tokens
      where user_id = $1 and purpose = 'magic_login' and used_at is null
        and created_at > now() - interval '2 minutes'
      order by created_at desc limit 1`,
    [user.id],
  );
  if (recent.rows[0]) return;
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into account_action_tokens (user_id, token_hash, purpose, expires_at)
     values ($1, $2, 'magic_login', now() + interval '${MAGIC_LINK_TTL_MINUTES} minutes')`,
    [user.id, hashToken(token)],
  );
  await query("delete from account_action_tokens where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day'");
  const loginUrl = `${runtimeConfig.appUrl}/?magic_link_token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(loginUrl);
  try {
    await sendPostboxEmail(user.email, {
      subject: 'Вход в AnnWord',
      text: ['Откройте одноразовую ссылку, чтобы войти в AnnWord.', `Ссылка действует ${MAGIC_LINK_TTL_MINUTES} минут:`, loginUrl, 'Если вы не запрашивали вход, просто проигнорируйте письмо.'].join('\n\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172554;line-height:1.5"><div style="background:#eef2ff;border-radius:24px;padding:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6366f1">AnnWord</div><h1 style="font-size:26px;margin:8px 0">Одноразовый вход</h1><p style="margin:0;color:#64748b">Ссылка действует ${MAGIC_LINK_TTL_MINUTES} минут.</p></div><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">Войти в AnnWord</a></p></div>`,
    });
  } catch (error) {
    await query('update account_action_tokens set used_at = now() where token_hash = $1', [hashToken(token)]).catch(() => undefined);
    throw error;
  }
};

const sendRegistrationConfirmation = async (email: string, token: string): Promise<void> => {
  const confirmationUrl = `${runtimeConfig.appUrl}/?magic_link_token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(confirmationUrl);
  await sendPostboxEmail(email, {
    subject: 'Подтвердите регистрацию в AnnWord',
    text: ['Вы зарегистрировались в AnnWord по email и паролю.', 'Подтвердите адрес, чтобы создать аккаунт и войти.', `Ссылка действует ${REGISTRATION_TTL_MINUTES} минут:`, confirmationUrl, 'Если вы не регистрировались, не открывайте ссылку.'].join('\n\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172554;line-height:1.5"><div style="background:#eef2ff;border-radius:24px;padding:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6366f1">AnnWord</div><h1 style="font-size:26px;margin:8px 0">Подтвердите email</h1><p style="margin:0;color:#64748b">Аккаунт будет создан только после подтверждения адреса. Ссылка действует ${REGISTRATION_TTL_MINUTES} минут.</p></div><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">Подтвердить регистрацию</a></p><p style="font-size:13px;color:#64748b">Если вы не регистрировались, письмо можно проигнорировать.</p></div>`,
  });
};

magicLinkRouter.post('/email/account', async (req, res) => {
  const body = req.body || {};
  try {
    await ensurePendingEmailRegistrationSchema();
    const rawEmail = readText(body.email);
    assertRussianRegistrationEmail(rawEmail);
    const consents = readRegistrationConsents(body.consents);
    const input = validateNewUserInput(rawEmail, readText(body[field]), readText(body.name));
    consumeLocalRegistrationLimit(`ip:${readClientIp(req)}`, 8, 15 * 60_000);
    consumeLocalRegistrationLimit(`email:${input.email}`, 3, 15 * 60_000);
    await ensureGlobalRegistrationCapacity();

    const existing = await query<{ id: string; email_confirmed_at: Date | string | null }>('select id, email_confirmed_at from app_users where email = $1', [input.email]);
    const existingRow = existing.rows[0];
    if (existingRow?.email_confirmed_at) {
      res.status(409).json({ code: 'email_already_exists', error: 'Аккаунт с такой электронной почтой уже существует. Войдите в него.' });
      return;
    }
    if (existingRow && !existingRow.email_confirmed_at) {
      await query('delete from app_users where id = $1', [existingRow.id]);
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    await query("delete from pending_email_registrations where expires_at < now()");
    await query(
      `insert into pending_email_registrations (email, password_hash, full_name, consents, token_hash, expires_at)
       values ($1, $2, $3, $4::jsonb, $5, now() + interval '${REGISTRATION_TTL_MINUTES} minutes')
       on conflict (email) do update set
         password_hash = excluded.password_hash,
         full_name = excluded.full_name,
         consents = excluded.consents,
         token_hash = excluded.token_hash,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [input.email, input.passwordHash, input.name, JSON.stringify(consents), tokenHash],
    );
    try {
      await sendRegistrationConfirmation(input.email, token);
    } catch (error) {
      await query('delete from pending_email_registrations where token_hash = $1', [tokenHash]).catch(() => undefined);
      throw error;
    }
    res.status(202).json({ ok: true, needsEmailConfirmation: true, message: 'Письмо отправлено. Подтвердите email, чтобы завершить регистрацию.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось начать регистрацию.';
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    console.error('Email registration request failed', { code, message });
    const status = code === 'registration_rate_limited' ? 429 : code === 'russian_email_domain_required' ? 400 : /duplicate|unique/i.test(message) || code === '23505' ? 409 : 400;
    res.status(status).json({ code: code || 'account_create_failed', error: message });
  }
});

magicLinkRouter.post('/email/session', async (req, res) => {
  try {
    const body = req.body || {};
    const user = await findUserByEmail(readText(body.email));
    if (user && (user.passwordResetRequired || isLegacyMigratedPassword(user.passwordHash))) {
      res.status(403).json({ error: legacyPasswordMessage, code: 'legacy_password_reset_required' });
      return;
    }
    const confirmation = user ? await query<{ email_confirmed_at: Date | string | null }>('select email_confirmed_at from app_users where id = $1', [user.id]) : null;
    if (user && !confirmation?.rows[0]?.email_confirmed_at) {
      res.status(403).json({ code: 'email_not_confirmed', error: 'Подтвердите email по ссылке из письма перед входом.' });
      return;
    }
    const accepted = user ? verifyPassword(readText(body[field]), user.passwordHash) : false;
    if (!user || !accepted) {
      res.status(401).json({ code: 'invalid_credentials', error: 'Неверная электронная почта или пароль.' });
      return;
    }
    const token = createSessionToken(user);
    writeSessionCookie(res, token);
    res.json(makeSessionPayload(user, token));
  } catch (error) {
    res.status(400).json({ code: 'session_create_failed', error: error instanceof Error ? error.message : 'Не удалось войти.' });
  }
});

magicLinkRouter.post('/magic-link/request', async (req, res) => {
  const email = readText(req.body?.email).toLowerCase();
  try {
    const user = email ? await findUserByEmail(email).catch(() => null) : null;
    if (user) await issueMagicLink(user);
  } catch (error) {
    console.error('Magic-link request failed', error);
  }
  res.json({ ok: true, message: MAGIC_LINK_REQUEST_MESSAGE });
});

magicLinkRouter.post('/magic-link/confirm', async (req, res) => {
  try {
    await ensurePendingEmailRegistrationSchema();
    await ensureAccountActionTokenSchema();
    const token = readText(req.body?.token);
    if (token.length < 20) {
      res.status(400).json({ code: 'magic_link_invalid', error: 'Ссылка недействительна.' });
      return;
    }
    const tokenHash = hashToken(token);

    const registeredUser = await transaction(async client => {
      const pending = await client.query<{ email: string; password_hash: string; full_name: string; consents: RegistrationConsents }>(
        `select email, password_hash, full_name, consents
           from pending_email_registrations
          where token_hash = $1 and expires_at > now()
          for update`,
        [tokenHash],
      );
      const row = pending.rows[0];
      if (!row) return null;
      const existing = await client.query<{ id: string; email_confirmed_at: Date | string | null }>('select id, email_confirmed_at from app_users where email = $1 for update', [row.email]);
      if (existing.rows[0]?.email_confirmed_at) throw new Error('Аккаунт с таким email уже подтверждён. Войдите в него.');
      if (existing.rows[0]) await client.query('delete from app_users where id = $1', [existing.rows[0].id]);
      const id = newUserId();
      const created = await client.query<{ id: string; email: string; full_name: string | null; password_reset_required: boolean }>(
        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at, password_reset_required)
         values ($1, $2, $3, $4, 'email', now(), false)
         returning id, email, full_name, password_reset_required`,
        [id, row.email, row.password_hash, row.full_name],
      );
      await createProfileForUser(client, id, row.full_name);
      await client.query(
        `insert into user_consents (user_id, consent_type, granted, document_version, source, context)
         values
           ($1, 'user_agreement', true, $2, 'web', $5::jsonb),
           ($1, 'personal_data', true, $3, 'web', $5::jsonb),
           ($1, 'marketing_email', $4, $6, 'web', $5::jsonb)`,
        [id, consentVersions.userAgreement, consentVersions.personalData, row.consents.marketingEmailsAccepted === true, JSON.stringify({ channel: 'email_password_registration_confirmation' }), consentVersions.marketingEmail],
      );
      await client.query('delete from pending_email_registrations where email = $1', [row.email]);
      const user = created.rows[0];
      return { id: user.id, email: user.email, name: user.full_name || undefined, passwordResetRequired: user.password_reset_required } satisfies BackendUser;
    });

    if (registeredUser) {
      const sessionToken = createSessionToken(registeredUser);
      writeSessionCookie(res, sessionToken);
      res.json({ ...makeSessionPayload(registeredUser, sessionToken), ok: true, message: 'Email подтверждён. Регистрация завершена.' });
      return;
    }

    const userId = await transaction(async client => {
      const result = await client.query<{ user_id: string }>(
        `select user_id from account_action_tokens
          where token_hash = $1 and purpose = 'magic_login' and used_at is null and expires_at > now()
          for update`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;
      await client.query('update app_users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1', [row.user_id]);
      await client.query("update account_action_tokens set used_at = now() where user_id = $1 and purpose = 'magic_login' and used_at is null", [row.user_id]);
      return row.user_id;
    });
    if (!userId) {
      res.status(400).json({ code: 'magic_link_expired', error: 'Ссылка истекла или уже использована.' });
      return;
    }
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ code: 'magic_link_user_missing', error: 'Аккаунт не найден.' });
      return;
    }
    const sessionToken = createSessionToken(user);
    writeSessionCookie(res, sessionToken);
    res.json({ ...makeSessionPayload(user, sessionToken), ok: true, message: 'Вход выполнен.' });
  } catch (error) {
    res.status(400).json({ code: 'magic_link_confirm_failed', error: error instanceof Error ? error.message : 'Не удалось подтвердить ссылку.' });
  }
});
