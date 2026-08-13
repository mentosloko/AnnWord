import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('entry route UX', () => {
  it('focuses the public funnel on parents and keeps teacher as a separate entry', () => {
    const appScreens = read('components/AppScreens.tsx');
    const landing = read('components/screens/LandingMixScreen.tsx');
    const accountModeSetup = read('components/screens/AccountModeSetupScreen.tsx');
    const header = read('components/layout/AppHeader.tsx');

    expect(appScreens).not.toContain('ModeEntryScreen');
    expect(appScreens).not.toContain("if (entryPath === 'practice' || entryPath === 'kids' || entryPath === 'teacher') onOpenRegister()");
    expect(appScreens).toContain('hasChosenAccountMode ? roleHomeScreen : accountModeSetup');
    expect(appScreens).toContain('account_mode_setup: hasChosenAccountMode ? homeScreen : accountModeSetup');

    expect(landing).toContain('Задали английские слова? Пусть ребёнок выучит их играючи.');
    expect(landing).toContain('Ученики повторяют заданные вами слова между занятиями');
    expect(landing).toContain('Создать аккаунт преподавателя');
    expect(landing).not.toContain('Кто будет пользоваться AnnWord?');
    expect(landing).not.toContain('Создать Practice-аккаунт');
    expect(landing).not.toContain('Выбрать формат и начать');
    expect(landing).toContain("window.history.replaceState({}, '', '/')");

    expect(accountModeSetup).toContain("suggestedMode || getModeFromCurrentPath() || 'parent'");
    expect(accountModeSetup).not.toContain('const OPTIONS');
    expect(header).toContain("guestTeacherLanding ? '/' : '/teacher'");
    expect(header).toContain('Преподавателям');
  });

  it('keeps legacy player access login-only instead of offering new registration', () => {
    const landing = read('components/screens/LandingMixScreen.tsx');
    expect(landing).toContain("entryPath === 'practice'");
    expect(landing).toContain('существующий аккаунт');
    expect(landing).toContain('ваш прогресс и привычный режим сохранятся');
  });

  it('keeps oversized and external assets out of the anonymous first load', () => {
    const landing = read('components/screens/LandingMixScreen.tsx');
    const indexHtml = read('index.html');
    expect(landing).not.toContain('/assets/games/line_game.webp');
    expect(landing).toContain("{ icon: '🐍', title: 'Змейка' }");
    expect(landing).toContain('loading="lazy"');
    expect(indexHtml).not.toContain('fonts.googleapis.com');
    expect(indexHtml).toContain('ui-sans-serif, system-ui');
  });
});

describe('dictionary UI labels', () => {
  it('does not expose word totals in dictionary selection or Premium marketing', () => {
    const sources = [
      read('components/screens/DictionarySettingsScreen.tsx'),
      read('components/screens/SetupScreenSafe.tsx'),
      read('components/screens/PremiumScreen.tsx'),
      read('components/screens/PracticeHomeScreenWithLetterSquare.tsx'),
      read('components/screens/ProfileScreen.tsx'),
      read('components/screens/AdultRoomScreen.tsx'),
      read('components/DictionaryPeek.tsx'),
      read('components/screens/DictionaryStudioScreen.tsx'),
    ].join('\n');

    expect(sources).not.toContain('getPremiumWordsCount');
    expect(sources).not.toContain('слов доступно');
    expect(sources).not.toContain('слов добавлено');
    expect(sources).not.toContain('Доступно для игр:');
    expect(sources).not.toContain('слов в активном словаре');
    expect(sources).not.toMatch(/item\.wordCount/);
    expect(sources).not.toContain('item.words.length');
  });
});
