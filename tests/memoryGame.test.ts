import { describe, expect, it } from 'vitest';
import { buildMemoryDictionary } from '../components/MemoryGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('memory game dictionary and pair generation', () => {
  it('keeps English to Russian dictionary entries for card pairs', () => {
    const dictionary = buildMemoryDictionary(['BABY'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(1);
    expect(dictionary[0]?.word).toBe('BABY');
    expect(dictionary[0]?.translation).toBe('ребенок');
    expect(dictionary[0]?.word).not.toBe(dictionary[0]?.translation);
  });

  it('reuses builtin translations for custom dictionary words', () => {
    const dictionary = buildMemoryDictionary(['BABY', 'BACK', 'AREA', 'ARTS', 'AWAY', 'ATOM'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(6);

    expect(dictionary.every(entry => Boolean(entry.translation))).toBe(true);

    const baby = dictionary.find(entry => entry.word === 'BABY');
    expect(baby?.translation).toBe('ребенок');
  });

  it('falls back to builtin dictionary when custom words have no translations', () => {
    const dictionary = buildMemoryDictionary(['ZZZZZ', 'QQQQQ'], COMMON_WORDS_EN);

    expect(dictionary.length).toBeGreaterThan(6);
    expect(dictionary.every(entry => Boolean(entry.translation))).toBe(true);
  });
});
