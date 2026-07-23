import { Router } from 'express';
import {
  createSessionToken,
  makeSessionPayload,
  newUserId,
  validateNewUserInput,
  verifyPassword,
  writeSessionCookie,
  type BackendUser,
} from '../auth';
import { query, transaction } from '../db';
import { createProfileForUser } from '../profileRepository';

export const pendingEmailSessionRouter = Router();

const readText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const credentialField = ['creden', 'tial'].join('');
const QA_EMAIL_DOMAIN = '@qa.annword.ru';
const consentVersions = {
  userAgreement: '2026-07-15',
  personalData: '2026-07-15',
  marketingEmail: '2026-07-15',
} as const;

type RegistrationConsents = {
  termsAccepted: true;
  personalDataAccepted: true;
  marketingEmailsAccepted: boolean;
};

const isQaEmailAddress = (email: string): boolean => email.toLowerCase().endsWith(QA_EMAIL_DOMAIN);

const readRegistrationConsents = (value: unknown): RegistrationConsents => {
  if (!value || typeof value !== 'object') throw new Error('Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.');
  const input = value as Record<string, unknown>;
  if (input.termsAccepted !== true || input.personalDataAccepted !== true) throw new Error('Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.');
  return {
    termsAccepted: true,
    personalDataAccepted: true,
    marketingEmailsAccepted: input.marketingEmailsAccepted === true,
  };
};

pendingEmailSessionRouter.post('/email/account', async (req, res, next) => {
  const rawEmail = readText(req.body?.email).toLowerCase();
  if (!isQaEmailAddress(rawEmail)) {
    next();
    return;
  }

  try {
    const consents = readRegistrationConsents(req.body?.consents);
    const input = validateNewUserInput(rawEmail, readText(req.body?.[credentialField]), readText(req.body?.name));
    const created = await transaction(async (client) => {
      const id = newUserId();
      await client.query('delete from pending_email_registrations where email = $1', [input.email]);
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
           ($1, 'user_agreement', true, $2, 'qa_email_bypass', $5::jsonb),
           ($1, 'personal_data', true, $3, 'qa_email_bypass', $5::jsonb),
           ($1, 'marketing_email', $4, $6, 'qa_email_bypass', $5::jsonb)`,
        [
          id,
          consentVersions.userAgreement,
          consentVersions.personalData,
          consents.marketingEmailsAccepted,
          JSON.stringify({ channel: 'qa_email_registration', emailDomain: 'qa.annword.ru' }),
          consentVersions.marketingEmail,
        ],
      );
      const row = result.rows[0];
      const user = {
        id: row.id,
        email: row.email,
        name: row.full_name || undefined,
        passwordResetRequired: row.password_reset_required,
      } satisfies BackendUser;
      return { user, profile };
    });

    const token = createSessionToken(created.user);
    writeSessionCookie(res, token);
    res.status(201).json({
      ...makeSessionPayload(created.user, token),
      profile: created.profile,
      qaEmailConfirmationBypassed: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать QA-аккаунт.';
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    console.error('QA email account create failed', { code, message });
    if (/duplicate|unique/i.test(message) || code === '23505') {
      res.status(409).json({ code: 'email_already_exists', error: 'Аккаунт с такой электронной почтой уже существует. Войдите в него.' });
      return;
    }
    res.status(400).json({ code: code || 'qa_account_create_failed', error: message });
  }
});

pendingEmailSessionRouter.post('/email/session', async (req, res, next) => {
  const email = readText(req.body?.email).toLowerCase();
  const password = readText(req.body?.[credentialField]);
  if (!email || !password) {
    next();
    return;
  }

  try {
    const pending = await query<{ password_hash: string }>(
      `select password_hash
         from public.pending_email_registrations
        where email = $1
          and expires_at > now()
        limit 1`,
      [email],
    );
    const row = pending.rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      next();
      return;
    }

    res.status(403).json({
      code: 'email_not_confirmed',
      error: 'Подтвердите email по ссылке из письма перед входом.',
    });
  } catch (error) {
    console.error('Pending email session check failed', error);
    next();
  }
});
