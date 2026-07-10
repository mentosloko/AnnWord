import { describe, expect, it } from 'vitest';
import { buildAnagramDictionary } from '../components/AnagramGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

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