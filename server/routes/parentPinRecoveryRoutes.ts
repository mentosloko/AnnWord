import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { requireAuth } from '../auth';
import { ensureAccountActionTokenSchema } from '../accountActionTokenSchema';
import { readRequiredEnv, runtimeConfig } from '../config';
import { query, transaction } from '../db';
import { sendPostboxEmail } from '../postboxEmailService';

export const parentPinRecoveryRouter = Router();

const readText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const PIN_RESET_TTL_MINUTES = 30;
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const digestPin = (value: string): string => createHmac('sha256', readRequiredEnv('COOKIE_SECRET')).update(value).digest('hex');
const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

parentPinRecoveryRouter.post('/pin/reset/confirm', async (req, res) => {
  try {
    await ensureAccountActionTokenSchema();
    const token = readText(req.body?.token);
    const accessCode = readText(req.body?.accessCode);
    if (token.length < 20) {
      res.status(400).json({ code: 'parent_pin_reset_token_invalid', error: 'Ссылка восстановления PIN недействительна.' });
      return;
    }
    if (!/^\d{4}$/.test(accessCode)) {
      res.status(400).json({ code: 'invalid_parent_pin', error: 'PIN должен состоять из 4 цифр.' });
      return;
    }
    const changed = await transaction(async client => {
      const result = await client.query<{ user_id: string }>(
        `select user_id from account_action_tokens
          where token_hash = $1 and purpose = 'parent_pin_reset' and used_at is null and expires_at > now()
          for update`,
        [hashToken(token)],
      );
      const row = result.rows[0];
      if (!row) return false;
      await client.query('update profiles set access_digest = $2, updated_at = now() where id = $1', [row.user_id, digestPin(accessCode)]);
      await client.query("update account_action_tokens set used_at = now() where user_id = $1 and purpose = 'parent_pin_reset' and used_at is null", [row.user_id]);
      return true;
    });
    if (!changed) {
      res.status(400).json({ code: 'parent_pin_reset_token_expired', error: 'Ссылка восстановления PIN истекла или уже использована.' });
      return;
    }
    res.json({ ok: true, message: 'Родительский PIN обновлён.' });
  } catch (error) {
    res.status(400).json({ code: 'parent_pin_reset_failed', error: error instanceof Error ? error.message : 'Не удалось изменить PIN.' });
  }
});

parentPinRecoveryRouter.post('/pin/reset/request', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await ensureAccountActionTokenSchema();
    const user = req.user!;
    const profile = await query<{ role: string | null; account_mode: string | null; access_digest: string | null }>('select role, account_mode, access_digest from profiles where id = $1', [user.id]);
    const row = profile.rows[0];
    if (!row || (row.role !== 'parent' && row.account_mode !== 'parent') || !row.access_digest) {
      res.status(400).json({ code: 'parent_pin_not_configured', error: 'Родительский PIN ещё не настроен.' });
      return;
    }
    const recent = await query<{ created_at: Date | string }>(
      `select created_at from account_action_tokens
        where user_id = $1 and purpose = 'parent_pin_reset' and used_at is null
          and created_at > now() - interval '2 minutes'
        order by created_at desc limit 1`,
      [user.id],
    );
    if (!recent.rows[0]) {
      const token = randomBytes(32).toString('base64url');
      await query(
        `insert into account_action_tokens (user_id, token_hash, purpose, expires_at)
         values ($1, $2, 'parent_pin_reset', now() + interval '${PIN_RESET_TTL_MINUTES} minutes')`,
        [user.id, hashToken(token)],
      );
      const resetUrl = `${runtimeConfig.appUrl}/?parent_pin_reset_token=${encodeURIComponent(token)}`;
      const safeUrl = escapeHtml(resetUrl);
      try {
        await sendPostboxEmail(user.email, {
          subject: 'Восстановление родительского PIN AnnWord',
          text: [
            'Вы запросили восстановление родительского PIN AnnWord Kids.',
            `Ссылка действует ${PIN_RESET_TTL_MINUTES} минут:`,
            resetUrl,
            'Если вы не запрашивали восстановление, проигнорируйте письмо.',
          ].join('\n\n'),
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172554;line-height:1.5"><div style="background:#faf5ff;border-radius:24px;padding:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9333ea">AnnWord Kids</div><h1 style="font-size:26px;margin:8px 0">Новый родительский PIN</h1><p style="margin:0;color:#64748b">Ссылка действует ${PIN_RESET_TTL_MINUTES} минут.</p></div><p style="margin:24px 0">Нажмите кнопку, чтобы установить новый PIN.</p><p><a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">Изменить PIN</a></p><p style="margin-top:24px;font-size:13px;color:#64748b">Если вы не запрашивали восстановление, письмо можно проигнорировать.</p></div>`,
        });
      } catch (error) {
        await query('update account_action_tokens set used_at = now() where token_hash = $1', [hashToken(token)]).catch(() => undefined);
        throw error;
      }
    }
    res.json({ ok: true, message: 'Письмо для восстановления PIN отправлено на email аккаунта.' });
  } catch (error) {
    res.status(400).json({ code: 'parent_pin_reset_request_failed', error: error instanceof Error ? error.message : 'Не удалось отправить письмо.' });
  }
});
