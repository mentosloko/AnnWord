import { describe, expect, it } from 'vitest';
import { buildAnagramDictionary } from '../components/AnagramGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('AnagramGame dictionary', () => {
  it('keeps builtin dictionary entries when custom dictionary is empty', () => {
    expect(buildAnagramDictionary([], COMMON_WORDS_EN)).toStrictEqual(COMMON_WORDS_EN);
  });

  it('reuses builtin entries for custom words when available', () => {
    const dictionary = buildAnagramDictionary(['BABY'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(1);
    expect(dictionary[0]?.word).toBe('BABY');
  });

  it('drops custom words when builtin translation is unavailable', () => {
    expect(buildAnagramDictionary(['CUSTOMWORD'], COMMON_WORDS_EN)).toEqual([]);
  });
});
