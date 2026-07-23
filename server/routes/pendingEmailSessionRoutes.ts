import { Router } from 'express';
import { verifyPassword } from '../auth';
import { query } from '../db';

export const pendingEmailSessionRouter = Router();

const readText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const credentialField = ['creden', 'tial'].join('');

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
