import type { NextFunction, Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { requireAuth } from '../auth';
import { query } from '../db';

export const adminUsersRouter = Router();

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const positiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

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
      console.error('Admin users authorization failed', error);
      res.status(500).json({ code: 'admin_check_failed', error: 'Admin authorization failed' });
    }
  });
}

type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  provider: string;
  email_confirmed_at: string | Date | null;
  created_at: string | Date;
  username: string | null;
  role: string | null;
  account_mode: string | null;
  subscription_tier: string | null;
  premium_expires_at: string | Date | null;
  child_display_name: string | null;
};

const mapUser = (row: AdminUserRow) => {
  const premiumExpiresAt = toIso(row.premium_expires_at);
  const subscriptionTier = row.subscription_tier === 'premium' ? 'premium' : 'free';
  const premiumActive = subscriptionTier === 'premium'
    && (premiumExpiresAt === null || Date.parse(premiumExpiresAt) > Date.now());

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    provider: row.provider === 'yandex' ? 'yandex' : 'email',
    emailConfirmed: Boolean(row.email_confirmed_at),
    createdAt: toIso(row.created_at)!,
    username: row.username,
    role: row.role,
    accountMode: row.account_mode,
    subscriptionTier,
    premiumExpiresAt,
    premiumActive,
    childDisplayName: row.child_display_name,
  };
};

adminUsersRouter.get('/', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const search = text(req.query.q).slice(0, MAX_SEARCH_LENGTH);
  const page = positiveInt(req.query.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, positiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  try {
    const where = `
      where (
        $1::text = ''
        or u.email ilike '%' || $1 || '%'
        or coalesce(u.full_name, '') ilike '%' || $1 || '%'
        or coalesce(p.username, '') ilike '%' || $1 || '%'
        or coalesce(p.child_display_name, '') ilike '%' || $1 || '%'
      )
    `;

    const [countResult, usersResult] = await Promise.all([
      query<{ total: string }>(
        `select count(*)::text as total
           from app_users u
           left join profiles p on p.id = u.id
           ${where}`,
        [search],
      ),
      query<AdminUserRow>(
        `select u.id,
                u.email,
                u.full_name,
                u.provider,
                u.email_confirmed_at,
                u.created_at,
                p.username,
                p.role,
                p.account_mode,
                p.subscription_tier,
                p.premium_expires_at,
                p.child_display_name
           from app_users u
           left join profiles p on p.id = u.id
           ${where}
          order by u.created_at desc, u.id desc
          limit $2
         offset $3`,
        [search, pageSize, offset],
      ),
    ]);

    const total = Number.parseInt(countResult.rows[0]?.total || '0', 10) || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      users: usersResult.rows.map(mapUser),
      page,
      pageSize,
      total,
      totalPages,
      search,
    });
  } catch (error) {
    console.error('Admin users list failed', error);
    res.status(500).json({ code: 'admin_users_list_failed', error: 'Не удалось загрузить список пользователей.' });
  }
});
