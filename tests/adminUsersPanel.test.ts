import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');

describe('admin users list', () => {
  it('mounts an admin-only paginated users endpoint without selecting auth secrets', () => {
    const api = read('server/yandex-api.ts');
    const route = read('server/routes/adminUsersRoutes.ts');

    expect(api).toContain('app.use("/api/admin/users", adminUsersRouter)');
    expect(route).toContain("adminUsersRouter.get('/', requireAdmin");
    expect(route).toContain("result.rows[0]?.role !== 'admin'");
    expect(route).toContain('from app_users u');
    expect(route).toContain('left join profiles p on p.id = u.id');
    expect(route).toContain('limit $2');
    expect(route).toContain('offset $3');
    expect(route).toContain('const MAX_PAGE_SIZE = 100');
    expect(route).toContain("res.setHeader('Cache-Control', 'no-store')");
    expect(route).not.toContain('password_hash');
    expect(route).not.toContain('yandex_id');
    expect(route).not.toContain('session_version');
  });

  it('supports account search and exposes only useful admin summary fields', () => {
    const route = read('server/routes/adminUsersRoutes.ts');
    const client = read('services/adminUsersService.ts');

    expect(route).toContain("u.email ilike '%' || $1 || '%'");
    expect(route).toContain("coalesce(u.full_name, '') ilike");
    expect(route).toContain("coalesce(p.child_display_name, '') ilike");
    expect(route).toContain('subscriptionTier');
    expect(route).toContain('childDisplayName');
    expect(client).toContain('/api/admin/users?');
    expect(client).toContain("query.set('pageSize'");
  });

  it('renders mobile cards and a desktop table in the admin cabinet', () => {
    const screen = read('components/screens/AdminControlCenterScreen.tsx');
    const panel = read('components/admin/AdminUsersPanel.tsx');

    expect(screen).toContain('<AdminUsersPanel />');
    expect(panel).toContain('Пользователи');
    expect(panel).toContain('Все зарегистрированные аккаунты AnnWord');
    expect(panel).toContain('md:hidden');
    expect(panel).toContain('hidden overflow-x-auto');
    expect(panel).toContain('Email, имя аккаунта или ребёнка');
    expect(panel).toContain('Всего: {total}');
  });
});
