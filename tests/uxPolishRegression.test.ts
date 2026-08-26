import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatPremiumAccessPeriod } from '../services/premiumAccess';
import { formatRussianCount, inflectRussianUnit, russianPlural } from '../utils/textUtils';

const read = (path: string) => readFileSync(path, 'utf8');

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
    expect(game).toContain('dictionary.length < 1 && emptyConfirmed');
  });
});
