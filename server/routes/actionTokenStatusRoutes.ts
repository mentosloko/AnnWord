import { createHash } from 'node:crypto';
import { Router } from 'express';
import { ensurePasswordResetSchema } from '../passwordResetSchema';
import { ensureAccountActionTokenSchema } from '../accountActionTokenSchema';
import { query } from '../db';

export const actionTokenStatusRouter = Router();

const readText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

actionTokenStatusRouter.post('/auth/password/reset/status', async (req, res) => {
  try {
    await ensurePasswordResetSchema();
    const token = readText(req.body?.token);
    if (token.length < 20) {
      res.json({ valid: false, code: 'password_reset_token_invalid', error: 'Ссылка восстановления недействительна.' });
      return;
    }
    const result = await query(
      `select 1
         from password_reset_tokens
        where token_hash = $1
          and used_at is null
          and expires_at > now()
        limit 1`,
      [hashToken(token)],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json(result.rows.length
      ? { valid: true }
      : { valid: false, code: 'password_reset_token_expired', error: 'Ссылка восстановления истекла или уже использована.' });
  } catch (error) {
    console.error('Password reset token status failed', error);
    res.status(500).json({ valid: false, code: 'password_reset_status_failed', error: 'Не удалось проверить ссылку восстановления.' });
  }
});

actionTokenStatusRouter.post('/family/pin/reset/status', async (req, res) => {
  try {
    await ensureAccountActionTokenSchema();
    const token = readText(req.body?.token);
    if (token.length < 20) {
      res.json({ valid: false, code: 'parent_pin_reset_token_invalid', error: 'Ссылка восстановления PIN недействительна.' });
      return;
    }
    const result = await query(
      `select 1
         from account_action_tokens
        where token_hash = $1
          and purpose = 'parent_pin_reset'
          and used_at is null
          and expires_at > now()
        limit 1`,
      [hashToken(token)],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json(result.rows.length
      ? { valid: true }
      : { valid: false, code: 'parent_pin_reset_token_expired', error: 'Ссылка восстановления PIN истекла или уже использована.' });
  } catch (error) {
    console.error('Parent PIN reset token status failed', error);
    res.status(500).json({ valid: false, code: 'parent_pin_reset_status_failed', error: 'Не удалось проверить ссылку восстановления PIN.' });
  }
});
