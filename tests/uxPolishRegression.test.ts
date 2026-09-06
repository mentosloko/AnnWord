import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatPremiumAccessPeriod } from '../services/premiumAccess';
import { formatRussianCount, inflectRussianUnit, russianPlural } from '../utils/textUtils';

const read = (path: string) => readFileSync(path, 'utf8');

// Keep this suite on the current main merge-ref before production merge.
describe('UAT UX polish regressions', () => {
  it('inflects Russian counts including teen exceptions and 21/22/25', () => {
    const words = ['слово', 'слова', 'слов'] as const;
    expect(formatRussianCount(1, words)).toBe('1 слово');
    expect(formatRussianCount(2, words)).toBe('2 слова');
    expect(formatRussianCount(5, words)).toBe('5 слов');
    expect(formatRussianCount(11, words)).toBe('11 слов');
    expect(formatRussianCount(21, words)).toBe('21 слово');
    expect(formatRussianCount(22, words)).toBe('22 слова');
    expect(formatRussianCount(25, words)).toBe('25 слов');
    expect(russianPlural(4, ['попытка', 'попытки', 'попыток'])).toBe('попытки');
    expect(inflectRussianUnit(1, 'попыток')).toBe('попытка');
    expect(inflectRussianUnit(21, 'слов')).toBe('слово');
  });

  it('keeps reusable Premium period fragments free of terminal punctuation', () => {
    const period = formatPremiumAccessPeriod('2027-01-15T00:00:00.000Z');
    expect(period).toMatch(/^до /);
    expect(period).not.toMatch(/[.。]$/u);
    expect(`${period}.`).not.toContain('..');
  });

  it('labels manually reopened rules as game rules, not another first launch', () => {
    const shell = read('components/screens/GameModeShell.tsx');
    const classic = read('components/screens/ClassicGameScreen.tsx');
    expect(shell).toContain('rulesReopened');
    expect(shell).toContain("rulesReopened ? 'Правила игры' : 'Первый запуск'");
    expect(shell).toContain("rulesReopened ? 'Закрыть правила' : 'Начать игру'");
    expect(classic).toContain("seen ? 'Правила игры' : 'Первый запуск'");
    expect(classic).toContain("seen ? 'Закрыть правила' : 'Начать игру'");
  });

  it('closes game rules with Escape in shared and Classic shells', () => {
    const shell = read('components/screens/GameModeShell.tsx');
    const classic = read('components/screens/ClassicGameScreen.tsx');
    for (const source of [shell, classic]) {
      expect(source).toContain("if (event.key !== 'Escape') return;");
      expect(source).toContain("window.addEventListener('keydown', onKeyDown)");
      expect(source).toContain("window.removeEventListener('keydown', onKeyDown)");
    }
  });

  it('does not call a saved custom list playable until the selected mode has playable words', () => {
    const setup = read('components/screens/SetupScreenSafe.tsx');
    expect(setup).toContain("dictionaryRuntime.status === 'ready' && immediateWordCount === 0");
    expect(setup).toContain("const sourceReady = sourceConfigured && !customModeUnavailable");
    expect(setup).toContain("'нет слов для режима'");
    expect(setup).toContain('customAvailabilityText');
    expect(setup).toContain('пока нет доступных слов с русским переводом');
  });

  it('inflects Snake letter counts and parent attempt/error counts', () => {
    const snake = read('components/LetterSquareGameV3.tsx');
    const parent = read('components/screens/AdultRoomScreen.tsx');
    expect(snake).toContain("russianPlural(round.word.word.length, ['буква', 'буквы', 'букв'])");
    expect(snake).toContain("russianPlural(lettersRemaining, ['буква', 'буквы', 'букв'])");
    expect(parent).toContain("russianPlural(attempts(word), ['попытка', 'попытки', 'попыток'])");
    expect(parent).toContain("russianPlural(word.mistakes, ['ошибка', 'ошибки', 'ошибок'])");
  });

  it('requires a complete four-digit parent PIN before enabling unlock', () => {
    const parent = read('components/screens/AdultRoomScreen.tsx');
    expect(parent).toContain('const pinReady = /^\\d{4}$/.test(pin);');
    expect(parent).toContain("id=\"parent-pin-error\"");
    expect(parent).toContain("disabled={!pinReady || busyAction === 'unlock' || busyAction === 'pin-reset'}");
    expect(parent).toContain("aria-describedby={pinError ? 'parent-pin-error parent-pin-help' : 'parent-pin-help'}");
  });

  it('keeps /login and /register on the app shell and opens the matching auth modal', () => {
    const shell = read('components/AppShell.tsx');
    const route = read('services/clientRoute.ts');
    expect(route).toContain("login: '/login'");
    expect(route).toContain("register: '/register'");
    expect(shell).toContain('getClientAuthModeFromPathname(window.location.pathname)');
    expect(shell).toContain('const effectiveShowLoginModal = showLoginModal || (authPathOpen && !isAuthenticated)');
    expect(shell).toContain('authMode={effectiveAuthMode}');
  });

  it('makes the insufficient-coins notice dismissible and self-expiring', () => {
    const peek = read('components/DictionaryPeek.tsx');
    expect(peek).toContain("window.setTimeout(() => setError(null), 4_000)");
    expect(peek).toContain('aria-label="Закрыть уведомление"');
    expect(peek).toContain('onClick={() => setError(null)}');
  });

  it('shows loading before a confirmed empty 1-of-2 dictionary and recovers after hydration', () => {
    const game = read('components/TranslationChoiceGame.tsx');
    expect(game).toContain('const [emptyConfirmed, setEmptyConfirmed] = useState(false)');
    expect(game).toContain("window.setTimeout(() => setEmptyConfirmed(true), 750)");
    expect(game).toContain('if (!question && !finished) setQuestion(makeQuestion(dictionary, null, reviewPriorities))');
    expect(game).toContain('Загружаю слова…');
    expect(game).toContain('dictionary.length < 2 && emptyConfirmed');
  });
});
