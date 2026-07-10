import { describe, expect, it } from 'vitest';
import { buildSprintDictionary } from '../components/SprintGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

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