import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('verified QA fixes', () => {
  it('allows Practice plan codes in the Yandex PostgreSQL constraint', () => {
    const migration = read('db/yandex/20260723_expand_premium_plan_codes.sql');
    expect(migration).toContain("'practice_month'");
    expect(migration).toContain("'practice_year'");
    expect(migration).toContain('premium_payments_plan_code_check');
  });

  it('explains an unconfirmed pending registration only after password verification', () => {
    const route = read('server/routes/pendingEmailSessionRoutes.ts');
    const server = read('server/yandex-api.ts');
    expect(route).toContain('pending_email_registrations');
    expect(route).toContain('verifyPassword(password, row.password_hash)');
    expect(route).toContain("code: 'email_not_confirmed'");
    expect(server.indexOf('pendingEmailSessionRouter')).toBeLessThan(server.indexOf('magicLinkRouter'));
  });

  it('uses the account email checkbox for weekly reports without Russian-domain copy', () => {
    const card = read('components/WeeklyReportSettingsCard.tsx');
    const repository = read('server/weeklyReportProfileRepository.ts');
    expect(card).toContain('type="checkbox"');
    expect(card).toContain('status?.accountEmail');
    expect(card).not.toContain('.ru или .рф');
    expect(card).not.toContain('weekly-report-email');
    expect(repository).toContain('u.email as account_email');
    expect(repository).not.toContain('isRussianRegistrationEmail');
  });

  it('uses teacher-assigned words as the active Kids pool and labels the source', () => {
    const pools = read('hooks/useDictionaryPools.ts');
    const appScreens = read('components/AppScreens.tsx');
    const setup = read('components/screens/SetupScreenSafe.tsx');
    expect(pools).toContain('assignedWords.length > 0 && currentHasPremium');
    expect(pools).toContain('toCustomEnrichedWords(assignedWords)');
    expect(appScreens).toContain("'Слова от преподавателя'");
    expect(setup).toContain("'От учителя'");
  });

  it('updates the Sprint prompt and answers without a wait-mode exit overlap', () => {
    const sprint = read('components/SprintGame.tsx');
    expect(sprint).not.toContain('AnimatePresence mode="wait"');
    expect(sprint).toContain("key={question?.id || 'empty'}");
    expect(sprint).toContain('question?.options.map');
  });

  it('keeps the Teacher dashboard inside narrow viewports', () => {
    const adultRoom = read('components/screens/AdultRoomScreen.tsx');
    expect(adultRoom).toContain('lg:grid-cols-[280px_minmax(0,1fr)]');
    expect(adultRoom).toContain('flex-col items-stretch');
    expect(adultRoom).toContain('grid-cols-2 gap-3 sm:grid-cols-3');
    expect(adultRoom).toContain('min-w-0');
  });

  it('formats indefinite Premium access grammatically', () => {
    const access = read('services/premiumAccess.ts');
    const profile = read('components/screens/ProfileScreen.tsx');
    const premium = read('components/screens/PremiumScreen.tsx');
    expect(access).toContain('formatPremiumAccessPeriod');
    expect(access).toContain("return 'без ограничения срока'");
    expect(profile).not.toContain('Premium до ${formatPremiumExpiresAt');
    expect(premium).not.toContain('Premium активен до:');
  });

  it('renders compact treat cards without duplicated description or shortage explanation', () => {
    const shop = read('components/Shop.tsx');
    expect(shop).toContain("activeTab === 'food' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'");
    expect(shop).toContain("const compactFood = item.type === 'food'");
    expect(shop).toContain('{!compactFood && <p');
    expect(shop).not.toContain('сыграйте ещё');
    expect(shop).not.toContain('Можно купить</div>');
  });
});
