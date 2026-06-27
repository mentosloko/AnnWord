import { describe, expect, it } from 'vitest';
import { buildMemoryDictionary } from '../components/MemoryGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('memory game dictionary and pair generation', () => {
  it('keeps builtin entries for custom words when available', () => {
    const dictionary = buildMemoryDictionary(['BABY'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(1);
    expect(dictionary[0]?.word).toBe('BABY');
    expect(dictionary[0]?.translation).toBeTruthy();
  });

  it('reuses builtin entries for several custom dictionary words', () => {
    const dictionary = buildMemoryDictionary(['BABY', 'BACK', 'AREA', 'ARTS', 'AWAY', 'ATOM'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(6);
    expect(dictionary.every(entry => Boolean(entry.translation))).toBe(true);
  });

  it('drops custom words when builtin translations are unavailable', () => {
    expect(buildMemoryDictionary(['ZZZZZ', 'QQQQQ'], COMMON_WORDS_EN)).toEqual([]);
  });
});
