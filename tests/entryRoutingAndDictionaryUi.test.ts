import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('entry route UX', () => {
  it('does not render separate placeholder pages or auto-open registration', () => {
    const appScreens = read('components/AppScreens.tsx');
    const landing = read('components/screens/LandingMixScreen.tsx');
    expect(appScreens).not.toContain('ModeEntryScreen');
    expect(appScreens).not.toContain("if (entryPath === 'practice' || entryPath === 'kids' || entryPath === 'teacher') onOpenRegister()");
    expect(appScreens).toContain('const homeScreen = isAuthenticated ? roleHomeScreen : landingMix;');
    expect(landing).toContain('Кто будет пользоваться AnnWord?');
    expect(landing).toContain('Создать Teacher-аккаунт');
    expect(landing).toContain('Ребёнок возвращается к словам ради игры');
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