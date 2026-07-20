import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('reported game UI regressions', () => {
  it('does not expose the dictionary inside Classic', () => {
    const classic = read('components/screens/ClassicGameScreen.tsx');
    expect(classic).not.toContain('<DictionaryPeek');
    expect(classic).not.toContain("import { DictionaryPeek }");
  });

  it('uses an adaptive scroll-safe shell for every non-Classic mode', () => {
    const shell = read('components/screens/GameModeShell.tsx');
    expect(shell).toContain('h-[100dvh] min-h-[100svh]');
    expect(shell).toContain('overflow-y-auto overscroll-contain');
    expect(shell).not.toContain('lg:flex-none');
  });

  it('shows an explicit continue action in 1 of 2 without duplicate answer copy', () => {
    const choice = read('components/TranslationChoiceGame.tsx');
    expect(choice).toContain("'Продолжить'");
    expect(choice).toContain('continueAfterAnswer');
    expect(choice).not.toContain('`Нужно: ${question.correct}`');
    expect(choice).not.toContain('goNextAfterWrong');
  });

  it('marks daily activity while completing the quest and displays day one defensively', () => {
    const repository = read('server/dailyQuestRepository.ts');
    const practice = read('components/screens/PracticeHomeScreenWithLetterSquare.tsx');
    expect(repository).toContain('reconcileProfileMood(userId, true)');
    expect(practice).toContain('questCompleted ? Math.max(1, storedStreak)');
  });
});
