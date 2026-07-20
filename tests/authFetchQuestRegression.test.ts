import fs from 'node:fs';
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
