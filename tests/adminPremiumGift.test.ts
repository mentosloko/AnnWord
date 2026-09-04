import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapProfileFromDB } from '../services/profileMapper';

const read = (path: string): string => readFileSync(path, 'utf8');

describe('admin Premium gifts', () => {
  it('mounts an admin-only API and extends existing access instead of replacing it', () => {
    const api = read('server/yandex-api.ts');
    const route = read('server/routes/adminPremiumRoutes.ts');

    expect(api).toContain('app.use("/api/admin/premium", adminPremiumRouter)');
    expect(route).toContain("adminPremiumRouter.get('/user', requireAdmin");
    expect(route).toContain("adminPremiumRouter.post('/grant', requireAdmin");
    expect(route).toContain('where lower(u.email) = $1');
    expect(route).toContain("when p.subscription_tier = 'premium' and p.premium_expires_at > now() then p.premium_expires_at");
    expect(route).toContain("else now()");
    expect(route).toContain('make_interval(days => $2::integer)');
    expect(route).toContain('transaction(async client =>');
    expect(route).not.toContain('insert into premium_payments');
  });

  it('limits a single gift, records the administrator action and keeps it separate from payments', () => {
    const route = read('server/routes/adminPremiumRoutes.ts');
    const migration = read('db/yandex/20260904_admin_premium_grants.sql');

    expect(route).toContain('const MAX_GRANT_DAYS = 365');
    expect(route).toContain('insert into admin_premium_grants');
    expect(route).toContain("event: 'admin_premium_granted'");
    expect(migration).toContain('create table if not exists public.admin_premium_grants');
    expect(migration).toContain('admin_user_id uuid not null references public.profiles');
    expect(migration).toContain('target_user_id uuid not null references public.profiles');
    expect(migration).toContain('granted_days integer not null check (granted_days between 1 and 365)');
  });

  it('surfaces an explicit two-step gift control in the admin cabinet', () => {
    const screen = read('components/screens/AdminControlCenterScreen.tsx');
    const panel = read('components/admin/AdminPremiumGiftPanel.tsx');
    const client = read('services/adminPremiumService.ts');

    expect(screen).toContain('<AdminPremiumGiftPanel />');
    expect(panel).toContain('Подарочный Premium');
    expect(panel).toContain('Найдите аккаунт по точному email');
    expect(panel).toContain('Подтвердить бесплатную выдачу?');
    expect(panel).toContain('Да, выдать Premium');
    expect(client).toContain('/api/admin/premium/user?email=');
    expect(client).toContain("'/api/admin/premium/grant'");
  });

  it('does not keep calling converted paid or gifted Premium a Kids trial', () => {
    const trialEnd = '2026-10-01T10:00:00.000Z';
    const activeTrial = mapProfileFromDB({
      username: 'Trial',
      role: 'parent',
      account_mode: 'parent',
      subscription_tier: 'premium',
      premium_expires_at: trialEnd,
      kids_trial_started_at: '2026-09-01T10:00:00.000Z',
      kids_trial_expires_at: trialEnd,
    });
    expect(activeTrial.kidsTrialExpiresAt).toBe(trialEnd);

    const converted = mapProfileFromDB({
      username: 'Gifted',
      role: 'parent',
      account_mode: 'parent',
      subscription_tier: 'premium',
      premium_expires_at: '2026-11-01T10:00:00.000Z',
      kids_trial_started_at: '2026-09-01T10:00:00.000Z',
      kids_trial_expires_at: trialEnd,
    });
    expect(converted.kidsTrialStartedAt).toBe('2026-09-01T10:00:00.000Z');
    expect(converted.kidsTrialExpiresAt).toBeUndefined();
  });
});
