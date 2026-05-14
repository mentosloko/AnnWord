import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../dictionaries/english';
import {
  buildDictionaryPools,
  getBuiltinSecretWordPool,
  getCustomSecretWordPool,
  getTranslationForWord,
  getValidationPool,
  normalizeCustomDictionary,
  pickRandomSecretWord,
} from '../services/dictionaryEngine';

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(`Dictionary smoke test failed: ${message}`);
  }
};

const initialCommonCount = COMMON_WORDS_EN.length;
const initialAllWordsCount = ALL_WORDS_EN.length;

assert(initialCommonCount > 0, 'COMMON_WORDS_EN must not be empty');
assert(initialAllWordsCount > 0, 'ALL_WORDS_EN must not be empty');

const customInput = [' apple ', 'APPLE', 'stone', 'fox!', 'data', 'stones'];
const normalizedCustom = normalizeCustomDictionary(customInput);

assert(normalizedCustom.includes('APPLE'), 'custom dictionary normalization must uppercase words');
assert(normalizedCustom.includes('FOX'), 'custom dictionary normalization must strip non-letters');
assert(normalizedCustom.filter(word => word === 'APPLE').length === 1, 'custom dictionary must be deduplicated');

const builtinFiveA1 = getBuiltinSecretWordPool({ wordLength: 5, difficulty: 'A1' });
assert(builtinFiveA1.length > 0, 'built-in A1 5-letter secret pool must not be empty');
assert(builtinFiveA1.every(item => item.word.length === 5), 'built-in secret pool must filter by word length');
assert(builtinFiveA1.every(item => item.level === 'A1'), 'built-in secret pool must filter by difficulty');

const customFive = getCustomSecretWordPool(customInput, 5);
assert(customFive.length > 0, 'custom 5-letter secret pool must not be empty for test input');
assert(customFive.every(item => item.word.length === 5), 'custom secret pool must filter active pool by word length');

const validationFive = getValidationPool({ wordLength: 5, customDictionaryEn: customInput });
assert(validationFive.includes('APPLE'), 'validation pool must include normalized custom words');
assert(validationFive.includes('STONE'), 'validation pool must include custom words of selected length');
assert(!validationFive.includes('DATA'), 'validation pool must filter custom words by selected word length');

const builtPools = buildDictionaryPools({
  source: 'custom',
  wordLength: 5,
  difficulty: 'ALL',
  customDictionaryEn: customInput,
});
assert(builtPools.dictionarySourceUsed === 'custom', 'custom source must be used when custom dictionary is available');
assert(builtPools.secretWordPool.every(item => item.word.length === 5), 'built pools secret pool must be length-filtered');
assert(builtPools.validationPool.includes('STONE'), 'built pools validation pool must include custom words');

const randomPick = pickRandomSecretWord(customFive, () => 0);
assert(randomPick?.word === customFive[0]?.word, 'random picker must support deterministic injected random function');

assert(getTranslationForWord('able'), 'translation lookup must work case-insensitively for built-in words');
assert(COMMON_WORDS_EN.length === initialCommonCount, 'dictionary engine must not mutate COMMON_WORDS_EN');
assert(ALL_WORDS_EN.length === initialAllWordsCount, 'dictionary engine must not mutate ALL_WORDS_EN');

console.log(JSON.stringify({
  ok: true,
  checked: 'dictionary-engine',
  counts: {
    commonWords: COMMON_WORDS_EN.length,
    allWords: ALL_WORDS_EN.length,
    builtinFiveA1: builtinFiveA1.length,
    normalizedCustom: normalizedCustom.length,
    customFive: customFive.length,
    validationFive: validationFive.length,
  },
}, null, 2));
