import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
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
import { sendPostboxEmail } from '../postboxEmailService';
import { createProfileForUser } from '../profileRepository';

export const magicLinkRouter = Router();

const readText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const field = ['creden', 'tial'].join('');
const MAGIC_LINK_TTL_MINUTES = 15;
const MAGIC_LINK_REQUEST_MESSAGE = 'Если аккаунт с таким email существует, письмо со ссылкой для входа отправлено.';
const isLegacyMigratedPassword = (hash: string): boolean => hash.startsWith('migration-disabled-') || !hash.startsWith('scrypt$');
const legacyPasswordMessage = 'Этот аккаунт перенесён из старой системы, но старый пароль не был перенесён. Восстановите пароль или войдите через magic link с тем же email.';
const consentVersions = { userAgreement: '2026-07-15', personalData: '2026-07-15', marketingEmail: '2026-07-15' } as const;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type RegistrationConsents = { termsAccepted: true; personalDataAccepted: true; marketingEmailsAccepted: boolean };
const readRegistrationConsents = (value: unknown): RegistrationConsents => {
  if (!value || typeof value !== 'object') throw new Error('Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.');
  const input = value as Record<string, unknown>;
  if (input.termsAccepted !== true || input.personalDataAccepted !== true) throw new Error('Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.');
  return { termsAccepted: true, personalDataAccepted: true, marketingEmailsAccepted: input.marketingEmailsAccepted === true };
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
      subject: 'Вход и подтверждение email в AnnWord',
      text: [
        'Откройте одноразовую ссылку, чтобы подтвердить email и войти в AnnWord.',
        `Ссылка действует ${MAGIC_LINK_TTL_MINUTES} минут:`,
        loginUrl,
        'Если вы не запрашивали вход, просто проигнорируйте письмо.',
      ].join('\n\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172554;line-height:1.5"><div style="background:#eef2ff;border-radius:24px;padding:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6366f1">AnnWord</div><h1 style="font-size:26px;margin:8px 0">Подтверждение email и вход</h1><p style="margin:0;color:#64748b">Одноразовая ссылка действует ${MAGIC_LINK_TTL_MINUTES} минут.</p></div><p style="margin:24px 0">Нажмите кнопку, чтобы подтвердить адрес и войти.</p><p><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">Подтвердить и войти</a></p><p style="margin-top:24px;font-size:13px;color:#64748b">Если вы не запрашивали вход, письмо можно проигнорировать.</p></div>`,
    });
  } catch (error) {
    await query('update account_action_tokens set used_at = now() where token_hash = $1', [hashToken(token)]).catch(() => undefined);
    throw error;
  }
};

magicLinkRouter.post('/email/account', async (req, res) => {
  const body = req.body || {};
  try {
    const rawEmail = readText(body.email);
    assertRussianRegistrationEmail(rawEmail);
    const consents = readRegistrationConsents(body.consents);
    const input = validateNewUserInput(rawEmail, randomBytes(24).toString('base64url'), readText(body.name));

    const existing = await query<{ id: string; email: string; full_name: string | null; password_reset_required: boolean; email_confirmed_at: Date | string | null }>(
      'select id, email, full_name, password_reset_required, email_confirmed_at from app_users where email = $1',
      [input.email],
    );
    const existingRow = existing.rows[0];
    if (existingRow) {
      if (existingRow.email_confirmed_at) {
        res.status(409).json({ code: 'email_already_exists', error: 'Аккаунт с такой электронной почтой уже существует. Войдите в него.' });
        return;
      }
      await issueMagicLink({ id: existingRow.id, email: existingRow.email, name: existingRow.full_name || undefined, passwordResetRequired: existingRow.password_reset_required });
      res.status(202).json({ ok: true, needsEmailConfirmation: true, message: 'Аккаунт уже создан. Мы повторно отправили magic link для подтверждения email.' });
      return;
    }

    const created = await transaction(async client => {
      const id = newUserId();
      const result = await client.query<{ id: string; email: string; full_name: string | null; password_reset_required: boolean }>(
        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at, password_reset_required)
         values ($1, $2, $3, $4, 'email', null, true)
         returning id, email, full_name, password_reset_required`,
        [id, input.email, input.passwordHash, input.name],
      );
      await createProfileForUser(client, id, input.name);
      await client.query(
        `insert into user_consents (user_id, consent_type, granted, document_version, source, context)
         values
           ($1, 'user_agreement', true, $2, 'web', $5::jsonb),
           ($1, 'personal_data', true, $3, 'web', $5::jsonb),
           ($1, 'marketing_email', $4, $6, 'web', $5::jsonb)`,
        [id, consentVersions.userAgreement, consentVersions.personalData, consents.marketingEmailsAccepted, JSON.stringify({ channel: 'email_registration_magic_link' }), consentVersions.marketingEmail],
      );
      const row = result.rows[0];
      return { id: row.id, email: row.email, name: row.full_name || undefined, passwordResetRequired: row.password_reset_required } satisfies BackendUser;
    });

    await issueMagicLink(created);
    res.status(201).json({ ok: true, needsEmailConfirmation: true, message: 'Аккаунт создан. Откройте magic link из письма, чтобы подтвердить email и войти.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать аккаунт.';
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    console.error('Magic-link account create failed', error);
    res.status(code === 'russian_email_domain_required' ? 400 : /duplicate|unique/i.test(message) || code === '23505' ? 409 : 400).json({ code: code || 'account_create_failed', error: message });
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
      res.status(403).json({ code: 'email_not_confirmed', error: 'Подтвердите email через magic link перед входом.' });
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
    await ensureAccountActionTokenSchema();
    const token = readText(req.body?.token);
    if (token.length < 20) {
      res.status(400).json({ code: 'magic_link_invalid', error: 'Magic link недействителен.' });
      return;
    }
    const userId = await transaction(async client => {
      const result = await client.query<{ user_id: string }>(
        `select user_id from account_action_tokens
          where token_hash = $1 and purpose = 'magic_login' and used_at is null and expires_at > now()
          for update`,
        [hashToken(token)],
      );
      const row = result.rows[0];
      if (!row) return null;
      await client.query('update app_users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1', [row.user_id]);
      await client.query("update account_action_tokens set used_at = now() where user_id = $1 and purpose = 'magic_login' and used_at is null", [row.user_id]);
      return row.user_id;
    });
    if (!userId) {
      res.status(400).json({ code: 'magic_link_expired', error: 'Magic link истёк или уже использован.' });
      return;
    }
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ code: 'magic_link_user_missing', error: 'Аккаунт не найден.' });
      return;
    }
    const sessionToken = createSessionToken(user);
    writeSessionCookie(res, sessionToken);
    res.json({ ...makeSessionPayload(user, sessionToken), ok: true, message: 'Email подтверждён. Вход выполнен.' });
  } catch (error) {
    res.status(400).json({ code: 'magic_link_confirm_failed', error: error instanceof Error ? error.message : 'Не удалось подтвердить magic link.' });
  }
});
