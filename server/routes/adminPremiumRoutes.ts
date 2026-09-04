import type { NextFunction, Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { requireAuth } from '../auth';
import { query, transaction } from '../db';

export const adminPremiumRouter = Router();

const MAX_GRANT_DAYS = 365;
const MAX_NOTE_LENGTH = 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const normalizedEmail = (value: unknown): string => text(value).toLowerCase();
const toIso = (value: string | Date | null): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    try {
      const result = await query<{ role: string | null }>('select role from profiles where id = $1', [req.user!.id]);
      if (result.rows[0]?.role !== 'admin') {
        res.status(403).json({ code: 'admin_required', error: 'Forbidden' });
        return;
      }
      next();
    } catch (error) {
      console.error('Admin Premium authorization failed', error);
      res.status(500).json({ code: 'admin_check_failed', error: 'Admin authorization failed' });
    }
  });
}

type AdminPremiumUserRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  account_mode: string | null;
  subscription_tier: string;
  premium_expires_at: string | Date | null;
};

const mapUser = (row: AdminPremiumUserRow) => {
  const premiumExpiresAt = toIso(row.premium_expires_at);
  const premiumActive = row.subscription_tier === 'premium'
    && (premiumExpiresAt === null || Date.parse(premiumExpiresAt) > Date.now());
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    accountMode: row.account_mode,
    subscriptionTier: row.subscription_tier === 'premium' ? 'premium' : 'free',
    premiumExpiresAt,
    premiumActive,
  };
};

adminPremiumRouter.get('/user', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const email = normalizedEmail(req.query.email);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    res.status(400).json({ code: 'invalid_email', error: 'Введите корректный email пользователя.' });
    return;
  }

  try {
    const result = await query<AdminPremiumUserRow>(
      `select u.id,
              u.email,
              p.username,
              p.role,
              p.account_mode,
              p.subscription_tier,
              p.premium_expires_at
         from app_users u
         join profiles p on p.id = u.id
        where lower(u.email) = $1
        limit 1`,
      [email],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ code: 'user_not_found', error: 'Пользователь с таким email не найден.' });
      return;
    }
    res.json({ user: mapUser(row) });
  } catch (error) {
    console.error('Admin Premium user lookup failed', error);
    res.status(500).json({ code: 'admin_premium_lookup_failed', error: 'Не удалось найти пользователя.' });
  }
});

adminPremiumRouter.post('/grant', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const userId = text(req.body?.userId);
  const days = Number(req.body?.days);
  const note = text(req.body?.note).slice(0, MAX_NOTE_LENGTH);

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    res.status(400).json({ code: 'invalid_user_id', error: 'Некорректный пользователь.' });
    return;
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_GRANT_DAYS) {
    res.status(400).json({ code: 'invalid_grant_days', error: `Можно выдать Premium на срок от 1 до ${MAX_GRANT_DAYS} дней.` });
    return;
  }

  try {
    const result = await transaction(async client => {
      const targetResult = await client.query<AdminPremiumUserRow>(
        `select u.id,
                u.email,
                p.username,
                p.role,
                p.account_mode,
                p.subscription_tier,
                p.premium_expires_at
           from app_users u
           join profiles p on p.id = u.id
          where u.id = $1
          for update of p`,
        [userId],
      );
      const target = targetResult.rows[0];
      if (!target) return { kind: 'not_found' as const };
      if (target.role === 'admin') return { kind: 'admin_target' as const };
      if (target.subscription_tier === 'premium' && target.premium_expires_at === null) {
        return { kind: 'lifetime' as const, user: mapUser(target) };
      }

      const previousExpiresAt = toIso(target.premium_expires_at);
      const updatedResult = await client.query<AdminPremiumUserRow>(
        `update profiles p
            set subscription_tier = 'premium',
                premium_expires_at = (
                  case
                    when p.subscription_tier = 'premium' and p.premium_expires_at > now() then p.premium_expires_at
                    else now()
                  end
                ) + make_interval(days => $2::integer),
                feature_flags = jsonb_set(
                  jsonb_set(coalesce(p.feature_flags, '{}'::jsonb), '{premiumDictionaries}', 'true'::jsonb, true),
                  '{adultRoom}', 'true'::jsonb, true
                ),
                updated_at = now()
          from app_users u
         where p.id = $1
           and u.id = p.id
         returning p.id,
                   u.email,
                   p.username,
                   p.role,
                   p.account_mode,
                   p.subscription_tier,
                   p.premium_expires_at`,
        [userId, days],
      );
      const updated = updatedResult.rows[0];
      if (!updated) return { kind: 'not_found' as const };
      const newExpiresAt = toIso(updated.premium_expires_at)!;

      await client.query(
        `insert into admin_premium_grants (
           admin_user_id,
           target_user_id,
           granted_days,
           previous_expires_at,
           new_expires_at,
           note
         ) values ($1, $2, $3, $4, $5, nullif($6, ''))`,
        [req.user!.id, userId, days, previousExpiresAt, newExpiresAt, note],
      );

      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Admin Premium gift granted',
        event: 'admin_premium_granted',
        admin_user_id: req.user!.id,
        target_user_id: userId,
        granted_days: days,
        previous_expires_at: previousExpiresAt,
        new_expires_at: newExpiresAt,
      }));

      return {
        kind: 'ok' as const,
        user: mapUser(updated),
        grantedDays: days,
        previousExpiresAt,
        premiumExpiresAt: newExpiresAt,
      };
    });

    if (result.kind === 'not_found') {
      res.status(404).json({ code: 'user_not_found', error: 'Пользователь не найден.' });
      return;
    }
    if (result.kind === 'admin_target') {
      res.status(400).json({ code: 'admin_target_not_supported', error: 'Администратору Premium доступен без подписки.' });
      return;
    }
    if (result.kind === 'lifetime') {
      res.status(409).json({ code: 'premium_has_no_expiry', error: 'У пользователя уже бессрочный Premium.', user: result.user });
      return;
    }

    res.json({
      ok: true,
      user: result.user,
      grantedDays: result.grantedDays,
      previousExpiresAt: result.previousExpiresAt,
      premiumExpiresAt: result.premiumExpiresAt,
    });
  } catch (error) {
    console.error('Admin Premium grant failed', error);
    res.status(500).json({ code: 'admin_premium_grant_failed', error: 'Не удалось выдать Premium. Попробуйте ещё раз.' });
  }
});
