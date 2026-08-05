import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { acquireScrollLock, getScrollLockCount, resetScrollLocks } from '../services/scrollLock';
import { clearRegistrationIntent, readRegistrationIntent, rememberRegistrationIntent } from '../services/registrationIntent';

const read = (path: string): string => readFileSync(path, 'utf8');

describe('Kids registration and onboarding system', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetScrollLocks();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('persists the selected Kids registration format until confirmation', () => {
    rememberRegistrationIntent('kids');
    expect(readRegistrationIntent()).toMatchObject({ entryPath: 'kids', accountMode: 'parent' });
    clearRegistrationIntent();
    expect(readRegistrationIntent()).toBeNull();

    const auth = read('hooks/useAuthProfile.ts');
    const router = read('server/routes/magicLinkRoutes.ts');
    const overlay = read('components/auth/MagicLinkOverlay.tsx');
    expect(auth).toContain("readRegistrationIntent()?.accountMode");
    expect(router).toContain('intended_account_mode');
    expect(router).toContain('createProfileForUser(client, id, row.full_name, initialRole, row.intended_account_mode');
    expect(overlay).toContain('registrationEntryPathForMode(accountMode)');
  });

  it('shows email confirmation and first-month Premium information in dialogs/onboarding', () => {
    const app = read('AppV2.tsx');
    const authModal = read('components/auth/AuthModal.tsx');
    const family = read('components/screens/FamilySetupScreen.tsx');
    const character = read('components/screens/CharacterOnboardingScreen.tsx');
    expect(app).toContain('title="Подтвердите регистрацию"');
    expect(authModal).toContain('Первый месяц бесплатно');
    expect(authModal).toContain('Kids Premium включится после подтверждения email');
    expect(family).toContain('Первый месяц Kids Premium бесплатно');
    expect(family).not.toContain('weeklyReportEmail');
    expect(family).not.toContain('Email взрослого');
    expect(character).toContain('Как назовёшь питомца?');
    expect(character).toContain('твоим играм');
    expect(character).not.toContain('onOpenPremium');
  });

  it('grants exactly one tracked month of Kids Premium on the server', () => {
    const repository = read('server/profileRepository.ts');
    const migration = read('db/yandex/20260805_kids_trial_and_registration_intent.sql');
    expect(repository).toContain("now() + interval '1 month'");
    expect(repository).toContain('kids_trial_started_at is null');
    expect(repository).toContain('kids_trial_expires_at');
    expect(migration).toContain('kids_trial_started_at');
    expect(migration).toContain('kids_trial_expires_at');
  });

  it('keeps dictionary choice on the child surface and uses a mobile step-by-step dialog', () => {
    const kids = read('components/screens/KidsHomeScreen.tsx');
    const screens = read('components/AppScreens.tsx');
    const dictionary = read('components/screens/DictionarySettingsScreen.tsx');
    expect(kids).toContain('Выбрать словарь');
    expect(kids).toContain('Твой прогресс');
    expect(screens).toContain("onOpenDictionary={() => onRouteChange('dictionary_settings')}");
    expect(screens).toContain("isParentAccount ? 'dictionary_settings' : 'dictionary_studio'");
    expect(dictionary).toContain('mobileWizardOpen');
    expect(dictionary).toContain('AccessibleDialog');
    expect(dictionary).toContain("MobileDictionaryStep = 'source' | 'difficulty' | 'premium' | 'spotlight_grade' | 'spotlight_section' | 'custom'");
    expect(dictionary).toContain('На телефоне словарь выбирается по шагам');
  });

  it('opens parent cabinets with Enter by using forms', () => {
    expect(read('components/screens/ParentDashboardScreen.tsx')).toContain('form onSubmit={event => { event.preventDefault(); void unlock(); }}');
    expect(read('components/screens/AdultRoomScreen.tsx')).toContain('form onSubmit={event => { event.preventDefault(); void unlock(); }}');
  });
});

describe('scroll and reward race regressions', () => {
  beforeEach(() => {
    resetScrollLocks();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  it('keeps the page locked until every nested modal releases its lock', () => {
    const releaseFirst = acquireScrollLock();
    const releaseSecond = acquireScrollLock();
    expect(getScrollLockCount()).toBe(2);
    expect(document.body.style.overflow).toBe('hidden');
    releaseFirst();
    expect(getScrollLockCount()).toBe(1);
    expect(document.body.style.overflow).toBe('hidden');
    releaseSecond();
    expect(getScrollLockCount()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('uses the shared scroll-lock hook in every modal that used to mutate body overflow', () => {
    for (const file of ['components/a11y/AccessibleDialog.tsx', 'components/modals/RulesModal.tsx', 'components/DailyQuestCard.tsx', 'components/auth/AuthModal.tsx', 'components/screens/PremiumScreen.tsx']) {
      expect(read(file)).toContain('useBodyScrollLock');
    }
    const all = ['components/a11y/AccessibleDialog.tsx', 'components/modals/RulesModal.tsx', 'components/DailyQuestCard.tsx', 'components/auth/AuthModal.tsx', 'components/screens/PremiumScreen.tsx'].map(read).join('\n');
    expect(all).not.toContain("document.body.style.overflow = 'hidden'");
  });

  it('persists the game reward before applying the daily background reward', () => {
    const app = read('AppV2.tsx');
    const controller = read('hooks/useClassicGameController.ts');
    expect(app.indexOf('await submitDailyQuestResult(input)')).toBeGreaterThan(app.indexOf('await profileEconomy.applyGameReward(input'));
    expect(controller.indexOf('await onDailyQuestResult')).toBeGreaterThan(controller.indexOf('await onStatsUpdate'));
    expect(read('server/profileRepository.ts')).toContain('keepCurrentWorld');
  });

  it('shows education when the first coins or XP arrive', () => {
    const app = read('AppV2.tsx');
    expect(app).toContain("readRewardEducation(currentUserId, 'coins')");
    expect(app).toContain("readRewardEducation(currentUserId, 'xp')");
    expect(app).toContain('Монеты нужны для лакомств');
    expect(app).toContain('Опыт повышает уровень питомца');
  });
});
