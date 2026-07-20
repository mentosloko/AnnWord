import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('mobile Practice root-cause regressions', () => {
  it('keeps routine session refresh invisible when cached UI is already available', () => {
    const gate = read('components/AuthBootstrapGate.tsx');
    expect(gate).toContain("if (mode === 'inline') return null");
    expect(gate).toContain('Keep only blocking flows');
  });

  it('does not duplicate the burger navigation below the mobile header', () => {
    const header = read('components/layout/AppHeader.tsx');
    expect(header).not.toContain('aria-label="Быстрая навигация"');
    expect(header).toContain('Серия ежедневных заданий');
    expect(header).toContain('Монеты:');
  });

  it('sizes Classic from the visible viewport and the actual remaining board container', () => {
    const grid = read('components/Grid.tsx');
    const screen = read('components/screens/ClassicGameScreen.tsx');
    expect(screen).toContain('h-[100dvh] min-h-[100svh]');
    expect(grid).toContain('100cqh');
    expect(grid).toContain("containerType: 'size'");
    expect(grid).not.toContain('calc((100svh - 10.25rem) / 6)');
  });

  it('shows first-play rules per account and mode, with rules still available through question mark', () => {
    const shell = read('components/screens/GameModeShell.tsx');
    const classic = read('components/screens/ClassicGameScreen.tsx');
    const screens = read('components/AppScreens.tsx');
    expect(shell).toContain('annword:game-intro:v1:${viewerKey}:${gameId}');
    expect(shell).toContain('Правила всегда можно открыть снова кнопкой «?»');
    expect(classic).toContain('annword:game-intro:v1:${rulesViewerKey}:classic');
    expect(screens).toContain('rulesViewerKey={rulesViewerKey}');
  });

  it('does not render or charge for a dictionary inside Snake', () => {
    const screens = read('components/AppScreens.tsx');
    const shell = read('components/screens/GameModeShell.tsx');
    expect(screens).toContain('gameId="letter_square"');
    expect(screens).toContain('showDictionary={false}');
    expect(shell).toContain('{showDictionary && <DictionaryPeek');
  });

  it('reuses the profile created by registration instead of immediately fetching it again', () => {
    const authRoute = read('server/routes/authRoutes.ts');
    const authService = read('services/authService.ts');
    const userService = read('services/userService.ts');
    expect(authRoute).toContain('profile: created.profile');
    expect(authRoute).toContain('Server-Timing');
    expect(authService).toContain('pendingRegisteredProfile');
    expect(authService).toContain('consumePendingRegisteredProfile');
    expect(userService).toContain('registeredProfile||profileApiService.getCurrentProfile()');
  });

  it('reconciles stats and daily quest before publishing the terminal Classic state', () => {
    const controller = read('hooks/useClassicGameController.ts');
    const reconciliation = controller.indexOf('Promise.all([statsPromise, questPromise])');
    const terminalPublish = controller.indexOf('gameStatus: terminalStatus');
    expect(reconciliation).toBeGreaterThan(-1);
    expect(terminalPublish).toBeGreaterThan(reconciliation);
    expect(controller).toContain('finishingRef.current');
  });

  it('keeps registration consents standard and concise', () => {
    const modal = read('components/auth/AuthModal.tsx');
    expect(modal).not.toContain('Первые два согласия обязательны');
    expect(modal).toContain('Обязательное согласие');
    expect(modal).toContain('className="ml-1 text-rose-500">*</span>');
  });

  it('uses concise dictionary, quest and anagram copy', () => {
    const dictionary = read('components/screens/DictionarySettingsScreen.tsx');
    const practice = read('components/screens/PracticeHomeScreenWithLetterSquare.tsx');
    const anagram = read('components/AnagramGame.tsx');
    expect(dictionary).toContain('Встроенный словарь с разными уровнями сложности.');
    expect(dictionary).not.toContain('В бесплатном режиме доступен базовый набор');
    expect(practice).not.toContain('Практика на сегодня выполнена');
    expect(practice).not.toContain('Можно сыграть ещё в любую игру или вернуться завтра');
    expect(practice).toContain('Серия: ${daysInRow} ${daysLabel(daysInRow)}');
    expect(anagram).not.toContain('Ошибок: {wrongAttempts}');
    expect(anagram).toContain('На это слово — 2 попытки');
  });
});