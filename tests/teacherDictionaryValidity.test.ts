import { beforeEach, describe, expect, it } from 'vitest';
import { buildPlayableGameDictionary, resetActiveGameDictionaryEntriesForTests, setActiveGameDictionaryEntries } from '../services/gameSessionEngine';
import { toCustomEnrichedWords } from '../services/dictionaryEngine';
import { ensureGeneralDictionaryLoaded, resetDictionaryRuntimeForTests } from '../services/dictionaryRuntime';
import { resetMasterDictionaryLookupForTests, resolveDictionaryWordTranslations } from '../services/masterDictionaryLookup';
import { mergeAssignedWordsIntoProfile } from '../server/profileHydration';
import { GUEST_PROFILE } from '../constants/profileDefaults';

beforeEach(() => {
  resetMasterDictionaryLookupForTests();
  resetDictionaryRuntimeForTests();
  resetActiveGameDictionaryEntriesForTests();
});

describe('teacher dictionary translation readiness', () => {
  it('resolves the UAT animal words from the canonical master dictionary', async () => {
    const result = await resolveDictionaryWordTranslations(['PANDA', 'TIGER', 'ZEBRA']);

    expect(result.missingWords).toEqual([]);
    expect(result.canonicalWords).toEqual(['PANDA', 'TIGER', 'ZEBRA']);
    expect(result.translations).toMatchObject({
      PANDA: 'панда',
      TIGER: 'тигр',
      ZEBRA: 'зебра',
    });
  });

  it('requires a Russian manual translation only when the master dictionary has none', async () => {
    const missing = await resolveDictionaryWordTranslations(['ZXQVV']);
    expect(missing.readyWords).toEqual([]);
    expect(missing.missingWords).toEqual(['ZXQVV']);

    const translated = await resolveDictionaryWordTranslations(['ZXQVV'], { ZXQVV: 'тестовое слово' });
    expect(translated.missingWords).toEqual([]);
    expect(translated.manualWords).toEqual(['ZXQVV']);
    expect(translated.translations.ZXQVV).toBe('тестовое слово');
  });

  it('hydrates assigned translations into the child profile', () => {
    const profile = mergeAssignedWordsIntoProfile(
      { ...GUEST_PROFILE, username: 'Child', customDictionaryEn: [] },
      ['PANDA', 'ZXQVV'],
      { PANDA: 'панда', ZXQVV: 'тестовое слово', UNUSED: 'лишнее' },
    );

    expect(profile.assignedWords).toEqual(['PANDA', 'ZXQVV']);
    expect(profile.assignedWordTranslations).toEqual({ PANDA: 'панда', ZXQVV: 'тестовое слово' });
    expect(profile.customDictionaryEn).toEqual(['PANDA', 'ZXQVV']);
  });

  it('keeps an explicitly translated assigned word playable in mini-games', async () => {
    await ensureGeneralDictionaryLoaded();
    const entries = toCustomEnrichedWords(['ZXQVV'], { ZXQVV: 'тестовое слово' });
    setActiveGameDictionaryEntries(entries);

    expect(entries).toEqual([{ word: 'ZXQVV', translation: 'тестовое слово', level: 'Custom' }]);
    expect(buildPlayableGameDictionary(['ZXQVV'])).toEqual(entries);
  });
});
