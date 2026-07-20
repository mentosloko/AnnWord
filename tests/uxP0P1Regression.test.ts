import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('P0 and P1 UX unification', () => {
  it('keeps magic-link login out of the user interface', () => {
    const auth = read('components/auth/AuthModal.tsx');
    expect(auth).not.toContain('magicLinkService');
    expect(auth.toLowerCase()).not.toContain('magic link');
    expect(auth).not.toContain('Войти по ссылке');
    expect(auth).toContain('Продолжить через Яндекс');
    expect(auth).toContain('аккаунт активируется после перехода по ссылке');
  });

  it('supports direct quick launch while preserving an editable setup screen', () => {
    const screens = read('components/AppScreens.tsx');
    const setup = read('components/screens/SetupScreenSafe.tsx');
    expect(screens).toContain('quickStartRequested');
    expect(screens).toContain('requestQuickLaunch');
    expect(screens).toContain('autoStart={quickStartRequested}');
    expect(setup).toContain('autoStart?: boolean');
    expect(setup).toContain('Игра начнётся автоматически');
    expect(setup).toContain('Настройки игры');
  });

  it('uses a single game chrome rather than duplicate menu buttons', () => {
    const shell = read('components/screens/GameModeShell.tsx');
    const gameFiles = [
      'components/TranslationChoiceGame.tsx',
      'components/SprintGame.tsx',
      'components/MemoryGame.tsx',
      'components/HangmanGame.tsx',
      'components/LetterSquareGameV3.tsx',
    ];
    expect(shell).toContain('data-testid="game-chrome"');
    expect(shell).toContain('aria-label="Назад"');
    gameFiles.forEach(path => expect(read(path)).not.toContain('← Меню'));
  });

  it('prioritizes the daily action and uses two game columns on mobile', () => {
    const practice = read('components/screens/PracticeHomeScreenWithLetterSquare.tsx');
    const kids = read('components/screens/KidsHomeScreen.tsx');
    expect(practice).toContain('Следующее действие');
    expect(practice).toContain('grid-cols-2');
    expect(kids).toContain('Задание на сегодня');
    expect(kids).toContain('grid-cols-2');
  });

  it('splits learner information into task-focused tabs', () => {
    const profile = read('components/screens/ProfileScreen.tsx');
    const parent = read('components/screens/ParentDashboardScreen.tsx');
    expect(profile).toContain('<SegmentedTabs');
    expect(profile).toContain("label: 'Подписка'");
    expect(profile).not.toContain('приоритет {item.currentReviewPriority}');
    expect(parent).toContain('<SegmentedTabs');
    expect(parent).toContain("label: 'Настройки'");
  });

  it('reduces reward completion to one primary action', () => {
    const reward = read('components/DailyQuestCard.tsx');
    expect(reward).toContain('Забрать награду');
    expect(reward).not.toContain('В магазин');
    expect(reward).not.toContain('Здорово!');
  });
});
