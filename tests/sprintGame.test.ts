import { describe, expect, it } from 'vitest';
import { buildSprintDictionary, pickSprintRoundWord } from '../components/SprintGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import type { EnrichedWord } from '../types';

describe('SprintGame dictionary', () => {
  it('keeps builtin dictionary values when custom dictionary is empty', () => {
    expect(buildSprintDictionary([], COMMON_WORDS_EN)).toEqual(COMMON_WORDS_EN);
  });

  it('reuses builtin translations for custom words when available', () => {
    const dictionary = buildSprintDictionary(['BABY'], COMMON_WORDS_EN);

    expect(dictionary).toEqual([
      expect.objectContaining({
        word: 'BABY',
        translation: 'ребенок',
      }),
    ]);
  });

  it('excludes custom words absent from the general dictionary', () => {
    const dictionary = buildSprintDictionary(['CUSTOMWORD'], COMMON_WORDS_EN);

    expect(dictionary).toEqual([]);
  });
});

describe('SprintGame round selection', () => {
  const entries: EnrichedWord[] = [
    { word: 'BUSHY', translation: 'кустистый', level: 'A2' },
    { word: 'APPLE', translation: 'яблоко', level: 'A1' },
    { word: 'WATER', translation: 'вода', level: 'A1' },
    { word: 'HOUSE', translation: 'дом', level: 'A1' },
  ];

  it('does not repeat a high-priority review word before the whole pool is shown', () => {
    const usedWords = new Set<string>();
    const selected: string[] = [];
    let previousWord: string | undefined;

    for (let index = 0; index < entries.length; index += 1) {
      const word = pickSprintRoundWord(entries, { BUSHY: 4 }, usedWords, previousWord, () => 0);
      expect(word).not.toBeNull();
      selected.push(word!.word);
      previousWord = word!.word;
    }

    expect(selected.filter(word => word === 'BUSHY')).toHaveLength(1);
    expect(new Set(selected)).toEqual(new Set(entries.map(entry => entry.word)));
  });

  it('starts a new cycle only after every available word has appeared', () => {
    const usedWords = new Set<string>();
    const firstCycle = entries.map(() => pickSprintRoundWord(entries, {}, usedWords, undefined, () => 0)!.word);
    const nextWord = pickSprintRoundWord(entries, {}, usedWords, firstCycle.at(-1), () => 0);

    expect(new Set(firstCycle).size).toBe(entries.length);
    expect(nextWord).not.toBeNull();
    expect(usedWords.size).toBe(1);
  });
});