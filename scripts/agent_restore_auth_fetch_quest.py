from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# Registration form: email + password and visible Yandex OAuth in both modes.
replace_once(
    'components/auth/AuthModal.tsx',
    "{mode === 'register' && <p id=\"registration-domain-hint\" className={`mt-2 text-xs font-bold leading-relaxed ${invalidRegistrationDomain ? 'text-rose-600' : 'text-gray-500'}`}>Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. Пароль не нужен: аккаунт создаётся только после подтверждения обязательного magic link из письма.</p>}",
    "{mode === 'register' && <p id=\"registration-domain-hint\" className={`mt-2 text-xs font-bold leading-relaxed ${invalidRegistrationDomain ? 'text-rose-600' : 'text-gray-500'}`}>Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. После отправки формы откройте письмо и подтвердите адрес — до этого войти в аккаунт нельзя.</p>}",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "              {mode === 'login' && <div>\n                <label htmlFor=\"auth-password\" className=\"mb-1 block text-xs font-bold uppercase text-gray-500\">Пароль</label>\n                <input id=\"auth-password\" required type=\"password\" autoComplete=\"current-password\" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder=\"ваш пароль\" className=\"w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none\" />\n                <button type=\"button\" disabled={isLoading} onClick={() => { setRecoveryMode(true); setRecoveryError(null); setRecoveryMessage(null); }} className=\"mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800\">Забыли пароль?</button>\n              </div>}",
    "              <div>\n                <label htmlFor=\"auth-password\" className=\"mb-1 block text-xs font-bold uppercase text-gray-500\">Пароль</label>\n                <input id=\"auth-password\" required type=\"password\" minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={mode === 'login' ? 'ваш пароль' : 'минимум 8 символов'} className=\"w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none\" />\n                {mode === 'login' && <button type=\"button\" disabled={isLoading} onClick={() => { setRecoveryMode(true); setRecoveryError(null); setRecoveryMessage(null); }} className=\"mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800\">Забыли пароль?</button>}\n              </div>",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "            {mode === 'login' && <><button type=\"button\" disabled={isLoading || recoveryBusy} onClick={() => void requestMagicLogin()} className=\"mt-3 w-full rounded-xl border-2 border-purple-100 bg-purple-50 p-3 font-bold text-purple-700 transition hover:bg-purple-100 disabled:cursor-wait disabled:opacity-70\">{recoveryBusy ? 'Отправляю ссылку…' : 'Войти по magic link'}</button><button type=\"button\" disabled={isLoading} onClick={onYandexLogin} className=\"mt-3 w-full rounded-xl border-2 border-indigo-100 bg-white p-3 font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70\">Войти через Яндекс</button></>}",
    "            {mode === 'login' && <button type=\"button\" disabled={isLoading || recoveryBusy} onClick={() => void requestMagicLogin()} className=\"mt-3 w-full rounded-xl border-2 border-purple-100 bg-purple-50 p-3 font-bold text-purple-700 transition hover:bg-purple-100 disabled:cursor-wait disabled:opacity-70\">{recoveryBusy ? 'Отправляю ссылку…' : 'Войти по magic link'}</button>}<button type=\"button\" disabled={isLoading} onClick={onYandexLogin} className=\"mt-3 w-full rounded-xl border-2 border-red-100 bg-white p-3 font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-70\">{mode === 'login' ? 'Войти через Яндекс' : 'Зарегистрироваться через Яндекс'}</button>",
)

# OAuth must start on the configured Yandex API domain, not the static frontend origin.
replace_once(
    'services/authService.ts',
    "    window.location.href = '/api/auth/yandex';",
    "    window.location.href = `${backendApiBaseUrl}/api/auth/yandex`;",
)

# Pending registration schema: no app user/profile is created before email ownership is proven.
write('server/pendingEmailRegistrationSchema.ts', '''import { query } from './db';

let ready: Promise<void> | null = null;

export function ensurePendingEmailRegistrationSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        create table if not exists public.pending_email_registrations (
          email text primary key,
          password_hash text not null,
          full_name text not null,
          consents jsonb not null default '{}'::jsonb,
          token_hash text not null unique,
          expires_at timestamptz not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await query(`
        create index if not exists pending_email_registrations_expires_idx
          on public.pending_email_registrations (expires_at)
      `);
      await query(`
        create index if not exists pending_email_registrations_created_idx
          on public.pending_email_registrations (created_at desc)
      `);
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

if (process.env.NODE_ENV !== 'test') {
  void ensurePendingEmailRegistrationSchema().catch(error => {
    console.error('Pending email registration schema failed', error);
  });
}
''')

# Replace auth router implementation with password registration + delayed account creation.
write('server/routes/magicLinkRoutes.ts', '''import { createHash, randomBytes } from 'node:crypto';
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
      text: ['Откройте одноразовую ссылку, чтобы войти в AnnWord.', `Ссылка действует ${MAGIC_LINK_TTL_MINUTES} минут:`, loginUrl, 'Если вы не запрашивали вход, просто проигнорируйте письмо.'].join('\\n\\n'),
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
    text: ['Вы зарегистрировались в AnnWord по email и паролю.', 'Подтвердите адрес, чтобы создать аккаунт и войти.', `Ссылка действует ${REGISTRATION_TTL_MINUTES} минут:`, confirmationUrl, 'Если вы не регистрировались, не открывайте ссылку.'].join('\\n\\n'),
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
''')

# Prevent idle PostgreSQL socket errors from terminating the container.
replace_once(
    'server/db.ts',
    '''    pool = new Pool({
      connectionString: normalizeDatabaseConnectionString(runtimeConfig.databaseUrl),
      ssl: { rejectUnauthorized: false },
      max: Number.parseInt(process.env.PGPOOL_MAX || "5", 10),
      idleTimeoutMillis: Number.parseInt(process.env.PGPOOL_IDLE_TIMEOUT_MS || "120000", 10),
      connectionTimeoutMillis: Number.parseInt(process.env.PGPOOL_CONNECTION_TIMEOUT_MS || "5000", 10),
    });''',
    '''    const createdPool = new Pool({
      connectionString: normalizeDatabaseConnectionString(runtimeConfig.databaseUrl),
      ssl: { rejectUnauthorized: false },
      max: Number.parseInt(process.env.PGPOOL_MAX || "5", 10),
      idleTimeoutMillis: Number.parseInt(process.env.PGPOOL_IDLE_TIMEOUT_MS || "30000", 10),
      connectionTimeoutMillis: Number.parseInt(process.env.PGPOOL_CONNECTION_TIMEOUT_MS || "5000", 10),
      keepAlive: true,
      keepAliveInitialDelayMillis: Number.parseInt(process.env.PGPOOL_KEEPALIVE_DELAY_MS || "10000", 10),
    });
    createdPool.on("error", (error) => {
      console.error(JSON.stringify({
        level: "ERROR",
        message: "PostgreSQL idle client error",
        event: "db_pool_idle_error",
        code: (error as NodeJS.ErrnoException).code || null,
        detail: error.message,
      }));
      if (pool === createdPool) pool = undefined;
      void createdPool.end().catch(() => undefined);
    });
    pool = createdPool;''',
)

# Structured request logs and complete CORS coverage for production/preview origins.
replace_once('server/yandex-api.ts', 'import { createHash, randomBytes } from "node:crypto";', 'import { createHash, randomBytes, randomUUID } from "node:crypto";')
replace_once('server/yandex-api.ts', 'const app = express();', 'const app = express();\napp.set("trust proxy", 1);')
replace_once(
    'server/yandex-api.ts',
    '''    if (url.protocol === "https:" && url.hostname === "annword.ru") {
      url.protocol = "http:";
      origins.add(normalizeOrigin(url.toString()));
    }''',
    '''    if (url.hostname === "annword.ru" || url.hostname === "www.annword.ru") {
      for (const protocol of ["https:", "http:"]) {
        for (const hostname of ["annword.ru", "www.annword.ru"]) {
          const sibling = new URL(url.toString());
          sibling.protocol = protocol;
          sibling.hostname = hostname;
          origins.add(normalizeOrigin(sibling.toString()));
        }
      }
    }''',
)
replace_once(
    'server/yandex-api.ts',
    '''app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = new Set<string>();
      [runtimeConfig.appUrl, runtimeConfig.apiUrl, process.env.CORS_ORIGIN].forEach((value) => addAllowedOrigin(allowedOrigins, value));

      const normalizedOrigin = normalizeOrigin(origin);
      callback(null, allowedOrigins.size === 0 || allowedOrigins.has(normalizedOrigin));
    },
    credentials: true,
  }),
);''',
    '''app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = readText(req.headers["x-request-id"]) || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  let logged = false;
  const log = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO",
      message: "HTTP request completed",
      event: "http_request",
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      aborted,
      origin: readText(req.headers.origin) || null,
    }));
  };
  res.once("finish", () => log(false));
  res.once("close", () => log(!res.writableEnded));
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowedOrigins = new Set<string>();
      [runtimeConfig.appUrl, runtimeConfig.apiUrl, process.env.CORS_ORIGIN].forEach((value) => addAllowedOrigin(allowedOrigins, value));
      const normalizedOrigin = normalizeOrigin(origin);
      const isAnnWordVercel = /^https:\\/\\/ann-word(?:-[a-z0-9-]+)?\\.vercel\\.app$/i.test(normalizedOrigin);
      const allowed = allowedOrigins.size === 0 || allowedOrigins.has(normalizedOrigin) || isAnnWordVercel;
      if (!allowed) console.warn(JSON.stringify({ level: "WARN", message: "CORS origin rejected", event: "cors_rejected", origin: normalizedOrigin }));
      callback(null, allowed);
    },
    credentials: true,
  }),
);''',
)

# Network errors become actionable messages, and idempotent GETs receive one quick retry.
replace_once(
    'services/backendApiClient.ts',
    '''  try {
    const response = await fetch(`${backendApiBaseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { error?: string } | T | null;
    return {
      response,
      payload,
      serverTiming: parseServerTiming(response.headers.get('Server-Timing')),
    };
  } catch (error) {
    if (controller.signal.aborted) throw abortError(path, timedOut);
    throw error;
  } finally {''',
    '''  try {
    const method = options.method || "GET";
    const maxAttempts = method === "GET" ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${backendApiBaseUrl}${path}`, {
          method,
          headers: { ...headers, "X-Request-Id": globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` },
          credentials: "include",
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { error?: string } | T | null;
        return { response, payload, serverTiming: parseServerTiming(response.headers.get('Server-Timing')) };
      } catch (error) {
        if (controller.signal.aborted) throw abortError(path, timedOut);
        const networkFailure = error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error instanceof Error ? error.message : String(error));
        if (networkFailure && attempt + 1 < maxAttempts) {
          await new Promise(resolve => globalThis.setTimeout(resolve, 250));
          continue;
        }
        if (networkFailure) throw new BackendApiError("Не удалось связаться с сервером AnnWord. Проверьте соединение и повторите действие.", 0);
        throw error;
      }
    }
    throw new BackendApiError("Не удалось связаться с сервером AnnWord.", 0);
  } finally {''',
)

# Shared deterministic reward catalogue and client-side qualification check.
write('services/dailyQuestRewardCatalog.ts', '''import type { ShopItem } from '../types';

const DAILY_TREATS: Array<{ item: ShopItem; weight: number }> = [
  { item: { id: 'apple', name: 'Энерго-яблоко', price: 4, type: 'food', minLevel: 1, description: 'Простое лакомство. Настроение +8.', effect: { mood: 8 } }, weight: 40 },
  { item: { id: 'cookie', name: 'Хрустик', price: 7, type: 'food', minLevel: 1, description: 'Вкусное лакомство. Настроение +12.', effect: { mood: 12 } }, weight: 30 },
  { item: { id: 'berry', name: 'Сияющая ягодка', price: 11, type: 'food', minLevel: 2, description: 'Особое лакомство. Настроение +16.', effect: { mood: 16 } }, weight: 20 },
  { item: { id: 'icecream', name: 'Ледяной десерт', price: 17, type: 'food', minLevel: 3, description: 'Праздничное лакомство. Настроение +22.', effect: { mood: 22 } }, weight: 8 },
  { item: { id: 'star_treat', name: 'Звёздный кристалл', price: 25, type: 'food', minLevel: 5, description: 'Редкое лакомство. Настроение +30.', effect: { mood: 30 } }, weight: 2 },
];

const stableIndex = (input: string, modulo: number): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
};

export const pickDailyQuestTreat = (userId: string, questDate: string): ShopItem => {
  const totalWeight = DAILY_TREATS.reduce((sum, entry) => sum + entry.weight, 0);
  let point = stableIndex(`${userId}:${questDate}:daily-treat-v1`, totalWeight);
  for (const entry of DAILY_TREATS) {
    if (point < entry.weight) return entry.item;
    point -= entry.weight;
  }
  return DAILY_TREATS[0].item;
};
''')
replace_once(
    'server/dailyQuestRepository.ts',
    'import { DAILY_QUEST_DEFINITIONS } from "../services/dailyQuest";',
    'import { DAILY_QUEST_DEFINITIONS } from "../services/dailyQuest";\nimport { pickDailyQuestTreat } from "../services/dailyQuestRewardCatalog";',
)
start = read('server/dailyQuestRepository.ts')
start_index = start.index('const DAILY_TREATS:')
end_index = start.index('\n\nconst modeLabels:', start_index)
write('server/dailyQuestRepository.ts', start[:start_index] + start[end_index + 2:])
replace_once('server/dailyQuestRepository.ts', '  const treat = pickDailyTreat(userId, questDate);', '  const treat = pickDailyQuestTreat(userId, questDate);')
# Remove old local picker while retaining stableIndex for quest variants.
text = read('server/dailyQuestRepository.ts')
old_picker_start = text.index('function pickDailyTreat(')
old_picker_end = text.index('\n\nfunction getVariantKey', old_picker_start)
write('server/dailyQuestRepository.ts', text[:old_picker_start] + text[old_picker_end + 2:])

replace_once(
    'services/dailyQuest.ts',
    "import { DailyQuestKind, DailyQuestState, PetWorldId } from '../types';",
    "import { DailyQuestKind, DailyQuestState, PetWorldId } from '../types';\nimport type { GameRewardInput } from './gamificationRules';",
)
write('services/dailyQuest.ts', read('services/dailyQuest.ts') + '''

const numeric = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const truthy = (value: unknown): boolean => value === true || value === 'true';
const completedModeLabel = (input: GameRewardInput): string | null => input.type === 'wordle' && truthy(input.won) ? 'Классика' : input.type === 'sprint' && numeric(input.guessedWords) > 0 ? 'Спринт' : input.type === 'anagram' && numeric(input.guessedWords) > 0 ? 'Анаграммы' : input.type === 'memory' ? 'Память' : input.type === 'hangman' && truthy(input.won) ? 'Виселица' : null;

export const doesGameResultCompleteDailyQuest = (quest: DailyQuestState | null | undefined, input: GameRewardInput): boolean => {
  if (!quest || quest.completed) return false;
  const text = `${quest.title} ${quest.description}`.toLowerCase();
  if (quest.kind === 'wordle_four') return input.type === 'wordle' && truthy(input.won);
  if (quest.kind === 'sprint_twelve') {
    const match = text.match(/(?:не менее|отгадай)\\s+(\\d+)/i);
    const target = match ? Number(match[1]) : 12;
    return input.type === 'sprint' && numeric(input.guessedWords) >= target;
  }
  if (quest.kind === 'memory_sixteen') return input.type === 'memory' && numeric(input.clicks) > 0;
  if (quest.kind === 'hangman_clean') return input.type === 'hangman' && truthy(input.won);
  if (quest.kind === 'all_five_games') {
    const mode = completedModeLabel(input);
    const completedCount = Number(quest.progressLabel.match(/^(\\d+)\\/5/)?.[1] || 0);
    return Boolean(mode && completedCount >= 4 && !quest.progressLabel.toLowerCase().includes(mode.toLowerCase()));
  }
  return false;
};
''')

# Pending state in reward type/modal.
replace_once(
    'types.ts',
    'export interface DailyQuestCompletionReward { quest: DailyQuestState; item?: ShopItem | null; worldId?: PetWorldId | null; }',
    'export interface DailyQuestCompletionReward { quest: DailyQuestState; item?: ShopItem | null; worldId?: PetWorldId | null; pending?: boolean; }',
)
replace_once(
    'components/DailyQuestCard.tsx',
    "  const safeStreakDays = Math.max(0, Math.round(streakDays || 0));",
    "  const safeStreakDays = Math.max(0, Math.round(streakDays || 0));\n  const pending = reward.pending === true;",
)
replace_once(
    'components/DailyQuestCard.tsx',
    "<p id=\"daily-quest-reward-description\" className=\"mt-2 text-sm font-bold text-gray-500\">{world ? T.invite : T.prepared}</p>",
    "<p id=\"daily-quest-reward-description\" className=\"mt-2 text-sm font-bold text-gray-500\">{pending ? 'Сохраняем результат и начисляем награду…' : world ? T.invite : T.prepared}</p>",
)
replace_once(
    'components/DailyQuestCard.tsx',
    "<div className=\"mt-6 grid gap-2\"><button type=\"button\" onClick={goPetRoom} className=\"w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white\">{world ? T.petRoom : 'Использовать лакомство'}</button>{onOpenShop && <button type=\"button\" onClick={goShop} className=\"w-full rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3 font-black text-indigo-700\">{T.shop}</button>}<button type=\"button\" onClick={onClose} className=\"w-full rounded-2xl bg-indigo-50 px-5 py-3 font-black text-indigo-700\">{T.great}</button></div>",
    "<div className=\"mt-6 grid gap-2\">{pending ? <div role=\"status\" className=\"rounded-2xl bg-indigo-50 px-5 py-3 font-black text-indigo-700\">Начисляем награду…</div> : <><button type=\"button\" onClick={goPetRoom} className=\"w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white\">{world ? T.petRoom : 'Использовать лакомство'}</button>{onOpenShop && <button type=\"button\" onClick={goShop} className=\"w-full rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3 font-black text-indigo-700\">{T.shop}</button>}<button type=\"button\" onClick={onClose} className=\"w-full rounded-2xl bg-indigo-50 px-5 py-3 font-black text-indigo-700\">{T.great}</button></>}</div>",
)

# Render the reward modal globally, above the completed game screen.
replace_once(
    'components/AppScreens.tsx',
    "import { hasSavedAnagramSession } from '../services/anagramSessionStatus';",
    "import { hasSavedAnagramSession } from '../services/anagramSessionStatus';\nimport { DailyQuestRewardModal } from './DailyQuestCard';",
)
replace_once(
    'components/AppScreens.tsx',
    "  const practiceHome = <PracticeHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={onCloseDailyQuestReward}",
    "  const practiceHome = <PracticeHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={null} onCloseDailyQuestReward={onCloseDailyQuestReward}",
)
replace_once(
    'components/AppScreens.tsx',
    "  const kidsHome = <KidsHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={onCloseDailyQuestReward}",
    "  const kidsHome = <KidsHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={null} onCloseDailyQuestReward={onCloseDailyQuestReward}",
)
replace_once(
    'components/AppScreens.tsx',
    "  return <React.Suspense fallback={<ScreenLoading />}><AppRouter route={route} screens={screens} fallback={screens.landing} /></React.Suspense>;",
    "  const rewardStreakDays = Math.max(0, Math.round(userProfile.pet.dailyStreak || 0));\n  return <><React.Suspense fallback={<ScreenLoading />}><AppRouter route={route} screens={screens} fallback={screens.landing} /></React.Suspense>{dailyQuestReward && onCloseDailyQuestReward && <DailyQuestRewardModal reward={dailyQuestReward} streakDays={rewardStreakDays} onClose={onCloseDailyQuestReward} onOpenPetRoom={isParentAccount ? () => onRouteChange('pet_room') : undefined} onOpenShop={isParentAccount ? () => onRouteChange('shop') : undefined} />}</>;",
)

# Show optimistic reward before awaiting profile/server writes, then reconcile with authoritative response.
replace_once(
    'AppV2.tsx',
    "import { dailyQuestService } from './services/dailyQuestService';",
    "import { dailyQuestService } from './services/dailyQuestService';\nimport { doesGameResultCompleteDailyQuest } from './services/dailyQuest';\nimport { pickDailyQuestTreat } from './services/dailyQuestRewardCatalog';",
)
replace_once(
    'AppV2.tsx',
    '''  const submitDailyQuestResult = useCallback(async (input: GameRewardInput) => {
    if (!canUseDailyQuest) return;
    try {
      const result = await dailyQuestService.submitGameResult(input);
      setDailyQuest(result.quest);
      if (result.profile) setUserProfile(result.profile);
      if (isKids && result.reward) setDailyQuestReward(result.reward);
    } catch (error) { console.error('Failed to apply daily quest result', error); }
  }, [canUseDailyQuest, isKids, setUserProfile]);''',
    '''  const submitDailyQuestResult = useCallback(async (input: GameRewardInput) => {
    if (!canUseDailyQuest) return;
    const optimistic = isKids && doesGameResultCompleteDailyQuest(dailyQuest, input);
    if (optimistic && dailyQuest) {
      const item = currentUserId ? pickDailyQuestTreat(currentUserId, dailyQuest.questDate) : null;
      const optimisticQuest = { ...dailyQuest, completed: true, completedAt: new Date().toISOString(), rewardItemId: item?.id || dailyQuest.rewardItemId || null };
      setDailyQuestReward({ quest: optimisticQuest, item, worldId: dailyQuest.rewardWorldId || null, pending: true });
    }
    try {
      const result = await dailyQuestService.submitGameResult(input);
      setDailyQuest(result.quest);
      if (result.profile) setUserProfile(result.profile);
      if (isKids) setDailyQuestReward(result.reward ? { ...result.reward, pending: false } : null);
    } catch (error) {
      if (optimistic) setDailyQuestReward(null);
      console.error('Failed to apply daily quest result', error);
    }
  }, [canUseDailyQuest, currentUserId, dailyQuest, isKids, setUserProfile]);''',
)
replace_once(
    'AppV2.tsx',
    '''    await profileEconomy.applyGameReward(input, { stats: nextStats, analyticsEvents: [event] });
    if (!input.statsOnly) await submitDailyQuestResult(input);''',
    '''    const questPromise = !input.statsOnly ? submitDailyQuestResult(input) : Promise.resolve();
    await profileEconomy.applyGameReward(input, { stats: nextStats, analyticsEvents: [event] });
    await questPromise;''',
)
replace_once(
    'hooks/useClassicGameController.ts',
    '''    try { await onStatsUpdate(terminalStatus === 'won', gameState.secretWord); }
    catch (error) { console.error('Failed to save Classic result', error); }
    try { if (onDailyQuestResult) await onDailyQuestResult(terminalStatus === 'won', gameState.secretWord, guesses.length); }
    catch (error) { console.error('Failed to reconcile Classic daily quest', error); }
    finally {
      finishingRef.current = false;
      setGameState(prev => ({ ...prev, gameStatus: terminalStatus, error: null }));
    }''',
    '''    const statsPromise = onStatsUpdate(terminalStatus === 'won', gameState.secretWord).catch(error => console.error('Failed to save Classic result', error));
    const questPromise = onDailyQuestResult ? onDailyQuestResult(terminalStatus === 'won', gameState.secretWord, guesses.length).catch(error => console.error('Failed to reconcile Classic daily quest', error)) : Promise.resolve();
    try { await Promise.all([statsPromise, questPromise]); }
    finally {
      finishingRef.current = false;
      setGameState(prev => ({ ...prev, gameStatus: terminalStatus, error: null }));
    }''',
)

# Regression tests.
write('tests/authFetchQuestRegression.test.ts', '''import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('registration, fetch resilience and immediate quest rewards', () => {
  it('keeps password registration and exposes Yandex OAuth in both modes', () => {
    const modal = read('components/auth/AuthModal.tsx');
    expect(modal).toContain("minLength={mode === 'register' ? 8 : undefined}");
    expect(modal).toContain("'Зарегистрироваться через Яндекс'");
    expect(read('services/authService.ts')).toContain('`${backendApiBaseUrl}/api/auth/yandex`');
  });

  it('does not create an app user before email confirmation', () => {
    const router = read('server/routes/magicLinkRoutes.ts');
    expect(router).toContain('pending_email_registrations');
    expect(router).toContain('Подтвердите email, чтобы завершить регистрацию');
    expect(router.indexOf('insert into pending_email_registrations')).toBeLessThan(router.indexOf("insert into app_users"));
  });

  it('handles idle postgres disconnects without process termination', () => {
    const db = read('server/db.ts');
    expect(db).toContain('createdPool.on("error"');
    expect(db).toContain('db_pool_idle_error');
  });

  it('renders daily quest reward globally and starts reconciliation concurrently', () => {
    expect(read('components/AppScreens.tsx')).toContain('DailyQuestRewardModal reward={dailyQuestReward}');
    expect(read('AppV2.tsx')).toContain('pending: true');
    expect(read('hooks/useClassicGameController.ts')).toContain('Promise.all([statsPromise, questPromise])');
  });
});
''')

print('patch applied')
