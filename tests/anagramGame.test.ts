import { beforeEach, describe, expect, it } from 'vitest';
import { buildAnagramDictionary, getIncorrectGuessPositions, getIncorrectGuessPositionsAfterAttempt } from '../components/AnagramGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { pickAdaptiveSessionWord, resetSessionWords } from '../services/gameSessionEngine';
import { resetAllSessionWordBucketsForTests } from '../services/sessionWordHistory';

describe('AnagramGame dictionary', () => {
  it('keeps builtin dictionary values when custom dictionary is empty', () => {
    expect(buildAnagramDictionary([], COMMON_WORDS_EN)).toEqual(COMMON_WORDS_EN);
  });

  it('reuses builtin translations for custom words when available', () => {
    const dictionary = buildAnagramDictionary(['BABY'], COMMON_WORDS_EN);

    expect(dictionary).toEqual([
      expect.objectContaining({
        word: 'BABY',
        translation: 'ребенок',
      }),
    ]);
  });

  it('excludes custom words absent from the general dictionary', () => {
    const dictionary = buildAnagramDictionary(['CUSTOMWORD'], COMMON_WORDS_EN);

    expect(dictionary).toEqual([]);
  });
});

describe('AnagramGame mistake feedback', () => {
  it('marks only letters that are in the wrong positions', () => {
    expect(getIncorrectGuessPositions('BOKO', 'BOOK')).toEqual([2, 3]);
  });

  it('does not mark letters that already match the target position', () => {
    expect(getIncorrectGuessPositions('BOOK', 'BOOK')).toEqual([]);
  });

  it('does not highlight the first wrong attempt', () => {
    expect(getIncorrectGuessPositionsAfterAttempt('BOKO', 'BOOK', 1)).toEqual([]);
  });

  it('highlights wrong positions after the second wrong attempt', () => {
    expect(getIncorrectGuessPositionsAfterAttempt('BOKO', 'BOOK', 2)).toEqual([2, 3]);
  });
});

describe('AnagramGame session pass', () => {
  const words = [
    { word: 'APPLE', translation: 'яблоко' },
    { word: 'BREAD', translation: 'хлеб' },
    { word: 'CHAIR', translation: 'стул' },
  ];

  beforeEach(() => {
    resetSessionWords('anagram');
    resetAllSessionWordBucketsForTests();
  });

  it('does not let a failed review word repeat before the rest of the pass', () => {
    const first = pickAdaptiveSessionWord('anagram', words, {}, null, () => 0);
    const second = pickAdaptiveSessionWord('anagram', words, { APPLE: 3 }, first?.word, () => 0);
    const third = pickAdaptiveSessionWord('anagram', words, { APPLE: 3 }, second?.word, () => 0);

    expect([first?.word, second?.word, third?.word]).toEqual(['APPLE', 'BREAD', 'CHAIR']);
  });
});
