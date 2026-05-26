import { describe, expect, it } from 'vitest';
import { buildAnagramDictionary } from '../components/AnagramGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('AnagramGame dictionary', () => {
  it('keeps builtin dictionary when custom dictionary is empty', () => {
    expect(buildAnagramDictionary([], COMMON_WORDS_EN)).toBe(COMMON_WORDS_EN);
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

  it('falls back to the word itself when builtin translation is unavailable', () => {
    const dictionary = buildAnagramDictionary(['CUSTOMWORD'], COMMON_WORDS_EN);

    expect(dictionary).toEqual([
      expect.objectContaining({
        word: 'CUSTOMWORD',
        translation: 'CUSTOMWORD',
      }),
    ]);
  });
});