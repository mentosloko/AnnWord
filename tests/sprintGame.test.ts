import { describe, expect, it } from 'vitest';
import { buildSprintDictionary } from '../components/SprintGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('SprintGame dictionary', () => {
  it('keeps builtin dictionary entries when custom dictionary is empty', () => {
    expect(buildSprintDictionary([], COMMON_WORDS_EN)).toStrictEqual(COMMON_WORDS_EN);
  });

  it('reuses builtin entries for custom words when available', () => {
    const dictionary = buildSprintDictionary(['BABY'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(1);
    expect(dictionary[0]?.word).toBe('BABY');
  });

  it('drops custom words when builtin translation is unavailable', () => {
    expect(buildSprintDictionary(['CUSTOMWORD'], COMMON_WORDS_EN)).toEqual([]);
  });
});
