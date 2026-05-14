import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../../dictionaries/english';
import { buildDictionaryPools, normalizeCustomDictionary } from '../../services/dictionaryEngine';

export default function handler(_req: any, res: any) {
  const custom = ['apple', 'APPLE', 'stone', 'data'];
  const normalized = normalizeCustomDictionary(custom);
  const pools = buildDictionaryPools({
    source: 'custom',
    wordLength: 5,
    difficulty: 'ALL',
    customDictionaryEn: custom,
  });

  const checks = {
    hasBuiltinDictionary: COMMON_WORDS_EN.length > 0,
    hasValidationDictionary: ALL_WORDS_EN.length > 0,
    customIsDeduplicated: normalized.length === 3,
    usesCustomPool: pools.dictionarySourceUsed === 'custom',
    filtersActivePoolByLength: pools.secretWordPool.every(item => item.word.length === 5),
    doesNotMutateMasterDictionary: COMMON_WORDS_EN.length > pools.secretWordPool.length,
    validationPoolIncludesCustom: pools.validationPool.includes('APPLE') && pools.validationPool.includes('STONE'),
  };

  const ok = Object.values(checks).every(Boolean);

  res.status(ok ? 200 : 500).json({
    ok,
    checks,
    counts: {
      commonWords: COMMON_WORDS_EN.length,
      allWords: ALL_WORDS_EN.length,
      customWords: normalized.length,
      activeSecretPool: pools.secretWordPool.length,
      validationPool: pools.validationPool.length,
    },
  });
}
