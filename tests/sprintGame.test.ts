import { describe, expect, it } from 'vitest';
import { buildSprintDictionary } from '../components/SprintGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('SprintGame dictionary', () => {
  it('keeps builtin dictionary when custom dictionary is empty', () => {
    expect(buildSprintDictionary([], COMMON_WORDS_EN)).toBe(COMMON_WORDS_EN);
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

  it('falls back to the custom word as translation when no builtin translation exists', () => {
    const dictionary = buildSprintDictionary(['CUSTOMWORD'], COMMON_WORDS_EN);

    expect(dictionary).toEqual([
      expect.objectContaining({
        word: 'CUSTOMWORD',
        translation: 'CUSTOMWORD',
        level: 'Custom',
      }),
    ]);
  });
});
