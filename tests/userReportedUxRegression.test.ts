import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDefaultKidsDictionaryId, getKidsDictionaryCatalog } from '../services/kidsDictionaryCatalog';
import { getAllFiveQuestCompletedMode, getDailyQuestPrimaryMode } from '../services/dailyQuest';
import { getPremiumDictionaryMeta } from '../services/premiumDictionaryCatalog';

const read = (path: string) => readFileSync(path, 'utf8');

describe('user-reported UX regressions', () => {
  it('keeps the registration modal compact and validates the domain only after input', () => {
    const modal = read('components/auth/AuthModal.tsx');
    expect(modal).not.toContain('Согласия</legend>');
    expect(modal).not.toContain('tracking-[0.2em] text-indigo-500">AnnWord');
    expect(modal).toContain('visibleMessage && <StableStatusSlot');
    expect(modal).toContain("const invalidRegistrationDomain = mode === 'register' && emailValid");
    expect(modal).toContain("id=\"auth-email-error\" role=\"alert\"");
    expect(modal).toContain("aria-describedby={emailError ? 'auth-email-error' : undefined}");
    expect(modal).toContain('text-xs font-medium leading-5');
  });

  it('uses noreply for authentication email and keeps the report sender separate', () => {
    const postbox = read('server/postboxEmailService.ts');
    const weekly = read('server/weeklyReportService.ts');
    expect(postbox).toContain("'noreply@annword.ru'");
    expect(postbox).not.toContain("requiredEnv('WEEKLY_REPORT_FROM_EMAIL')");
    expect(weekly).toContain("requiredEnv('WEEKLY_REPORT_FROM_EMAIL')");
  });

  it('shows topical kids dictionaries instead of separate grades', () => {
    const catalog = getKidsDictionaryCatalog();
    expect(catalog.some(item => item.theme === 'grade')).toBe(false);
    expect(catalog.map(item => item.shortTitle)).not.toEqual(expect.arrayContaining(['1 класс', '2 класс', '3 класс']));
    expect(getDefaultKidsDictionaryId()).toBe('kids_animals');
    expect(getPremiumDictionaryMeta('premium_spotlight_school').title).toBe('Школьные (Spotlight)');
  });

  it('renders the custom dictionary editor only inside the custom source', () => {
    const selector = read('components/screens/DictionarySettingsScreen.tsx');
    expect(selector).toContain("source === 'custom' && hasPremium");
    expect(selector).not.toContain("source !== 'custom'");
    expect(selector).not.toContain('>Мой словарь</span>');
  });

  it('opens the matching shop section and reacts when a treat is used', () => {
    const room = read('components/PetRoom.tsx');
    const shop = read('components/Shop.tsx');
    expect(room).not.toContain('доступно предметов');
    expect(room).toContain('Перейти в магазин');
    expect(room).toContain('setPettingBurst(value => value + 1)');
    expect(room).toContain('Ой, как вкусно!');
    expect(shop).toContain('readInitialShopTab');
    expect(shop).toContain('annword_shop_initial_tab');
  });

  it('starts the compound daily quest with Snake and counts Snake completion', () => {
    const quest = {
      questDate: '2026-08-06',
      kind: 'all_five_games' as const,
      title: 'Большое приключение',
      description: 'За сегодня: собери 6 слов в Змейке.',
      progressLabel: '0/5: начни с любой игры',
      completed: false,
      completedAt: null,
      rewardItemId: null,
      rewardWorldId: null,
    };
    expect(getDailyQuestPrimaryMode(quest)).toBe('letter_square');
    expect(getAllFiveQuestCompletedMode({ type: 'letterSquare', guessedWords: 6 })).toBe('letter_square');
    expect(getAllFiveQuestCompletedMode({ type: 'wordle', won: true })).toBeNull();
  });

  it('excludes every already used Snake word from the current session', () => {
    const snake = read('components/LetterSquareGameV3.tsx');
    expect(snake).toContain('usedWordsRef');
    expect(snake).toContain('pool.filter(item => !excluded.has(item.word))');
    expect(snake).toContain('usedWordsRef.current.clear()');
  });
});
