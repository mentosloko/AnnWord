import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('entry route UX', () => {
  it('does not render separate placeholder pages or auto-open registration', () => {
    const appScreens = read('components/AppScreens.tsx');
    const landing = read('components/screens/LandingMixScreen.tsx');
    expect(appScreens).not.toContain('ModeEntryScreen');
    expect(appScreens).not.toContain("if (entryPath === 'practice' || entryPath === 'kids' || entryPath === 'teacher') onOpenRegister()");
    expect(appScreens).toContain('hasChosenAccountMode ? roleHomeScreen : accountModeSetup');
    expect(appScreens).toContain('account_mode_setup: hasChosenAccountMode ? homeScreen : accountModeSetup');
    expect(landing).toContain('Кто будет пользоваться AnnWord?');
    expect(landing).toContain('Создать Teacher-аккаунт');
    expect(landing).toContain('Ребёнок возвращается к словам ради игры');
  });

  it('keeps oversized and external assets out of the anonymous first load', () => {
    const landing = read('components/screens/LandingMixScreen.tsx');
    const indexHtml = read('index.html');
    const indexEntry = read('index.tsx');
    const runtime = read('AppRuntime.tsx');
    expect(landing).not.toContain('/assets/games/line_game.webp');
    expect(landing).toContain("{ icon: '🐍', title: 'Змейка' }");
    expect(landing).toContain('loading="lazy"');
    expect(indexHtml).not.toContain('fonts.googleapis.com');
    expect(indexHtml).toContain('ui-sans-serif, system-ui');
    expect(indexEntry).toContain("React.lazy(() => import('./AppRuntime'))");
    expect(indexEntry).not.toContain("import App from './AppV2'");
    expect(indexEntry).not.toContain("import { PasswordResetOverlay }");
    expect(runtime).toContain("import App from './AppV2'");
    expect(runtime).toContain('PasswordResetOverlay');
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
