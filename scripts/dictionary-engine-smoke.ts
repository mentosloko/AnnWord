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
import { parseDictionaryText } from '../services/dictionaryUpload';
import {
  getGuessTranslationForGame,
  getHintPoolForGame,
  isValidGuessForGame,
  pickSecretForGame,
  prepareGameDictionary,
} from '../services/gameDictionaryAdapter';
import { mapProfileFromDB, normalizeDictionaryField } from '../services/profileMapper';

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(`Dictionary smoke test failed: ${message}`);
  }
};

const initialCommonCount = COMMON_WORDS_EN.length;
const initialAllWordsCount = ALL_WORDS_EN.length;

assert(initialCommonCount > 0, 'COMMON_WORDS_EN must not be empty');
assert(initialAllWordsCount > 0, 'ALL_WORDS_EN must not be empty');

const customInput = [' apple ', 'APPLE', 'berry!', 'data', 'cat', 'zzzzz'];
const normalizedCustom = normalizeCustomDictionary(customInput);

assert(normalizedCustom.includes('APPLE'), 'custom dictionary normalization must uppercase words');
assert(normalizedCustom.includes('BERRY'), 'custom dictionary normalization must strip non-letters');
assert(normalizedCustom.filter(word => word === 'APPLE').length === 1, 'custom dictionary must be deduplicated');
assert(JSON.stringify(normalizeDictionaryField(customInput)) === JSON.stringify(normalizedCustom), 'profile dictionary normalization must match dictionary engine normalization');

const uploadedText = customInput.join('\n');
const uploadResult = parseDictionaryText(uploadedText);
assert(JSON.stringify(uploadResult.words) === JSON.stringify(normalizedCustom), 'dictionary upload parser must match dictionary engine normalization');
assert(uploadResult.diagnostics.rawTokenCount === customInput.length, 'dictionary upload diagnostics must preserve raw token count');
assert(uploadResult.diagnostics.importedCount === normalizedCustom.length, 'dictionary upload diagnostics must expose imported word count');
assert(uploadResult.diagnostics.duplicateCount === 1, 'dictionary upload diagnostics must count duplicates');
assert(uploadResult.diagnostics.invalidTokenCount === 1, 'dictionary upload diagnostics must count cleaned invalid tokens');
assert(uploadResult.warnings.length >= 2, 'dictionary upload parser must expose non-blocking warnings');

const largeDictionaryWords = Array.from({ length: 250 }, (_, index) => `WORD${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`);
const largeDictionaryText = largeDictionaryWords.join('\n');
const largeUploadResult = parseDictionaryText(largeDictionaryText);
assert(largeUploadResult.words.length === 250, 'dictionary upload parser must not silently truncate large dictionaries');
assert(largeUploadResult.diagnostics.importedCount === 250, 'large dictionary diagnostics must match imported count');
assert(largeUploadResult.diagnostics.invalidTokenCount === 0, 'large dictionary smoke words must be valid English-letter tokens');

const dirtyProfile = mapProfileFromDB({
  username: 'Tester',
  custom_dictionary_en: customInput,
  stats: { gamesPlayed: 1, gamesWon: 1, wordsGuessed: { APPLE: 1 } },
  pet: { name: 'Owl' },
  coins: 50,
  inventory: [],
});
assert(JSON.stringify(dirtyProfile.customDictionaryEn) === JSON.stringify(normalizedCustom), 'DB profile mapper must normalize custom dictionary with dictionary engine rules');

const builtinFiveA1 = getBuiltinSecretWordPool({ wordLength: 5, difficulty: 'A1' });
assert(builtinFiveA1.length > 0, 'built-in A1 5-letter secret pool must not be empty');
assert(builtinFiveA1.every(item => item.word.length === 5), 'built-in secret pool must filter by word length');
assert(builtinFiveA1.every(item => item.level === 'A1'), 'built-in secret pool must filter by difficulty');

const customFive = getCustomSecretWordPool(customInput, 5);
assert(customFive.length > 0, 'custom 5-letter secret pool must not be empty for supported test input');
assert(customFive.every(item => item.word.length === 5), 'custom secret pool must filter active pool by word length');
assert(customFive.every(item => ['APPLE', 'BERRY'].includes(item.word)), 'custom secret pool must only include supported translated words');

const validationFive = getValidationPool({ wordLength: 5, customDictionaryEn: customInput });
assert(validationFive.includes('APPLE'), 'validation pool must include supported normalized custom words');
assert(validationFive.includes('BERRY'), 'validation pool must include supported cleaned custom words of selected length');
assert(!validationFive.includes('ZZZZZ'), 'validation pool must exclude unsupported custom words');
assert(!validationFive.includes('DATA'), 'validation pool must filter custom words by selected word length');

const builtPools = buildDictionaryPools({
  source: 'custom',
  wordLength: 5,
  difficulty: 'ALL',
  customDictionaryEn: customInput,
});
assert(builtPools.dictionarySourceUsed === 'custom', 'custom source must be used when custom dictionary is available');
assert(builtPools.secretWordPool.every(item => item.word.length === 5), 'built pools secret pool must be length-filtered');
assert(builtPools.validationPool.includes('BERRY'), 'built pools validation pool must include supported custom words');
assert(!builtPools.validationPool.includes('ZZZZZ'), 'built pools validation pool must reject unsupported custom words');

const randomPick = pickRandomSecretWord(customFive, () => 0);
assert(randomPick?.word === customFive[0]?.word, 'random picker must support deterministic injected random function');

const preparedCustomGameDictionary = prepareGameDictionary({
  settings: { wordLength: 5, dictionarySource: 'custom', difficulty: 'ALL' },
  userProfile: { customDictionaryEn: customInput },
});
assert(preparedCustomGameDictionary.errorMessage === null, 'game adapter must not return error when custom active pool exists');
assert(preparedCustomGameDictionary.dictionarySourceUsed === 'custom', 'game adapter must preserve custom dictionary source');
assert(isValidGuessForGame('berry', preparedCustomGameDictionary), 'game adapter validation must accept supported custom words');
assert(!isValidGuessForGame('zzzzz', preparedCustomGameDictionary), 'game adapter validation must reject unsupported custom words');
assert(!isValidGuessForGame('data', preparedCustomGameDictionary), 'game adapter validation must reject wrong word length');
assert(pickSecretForGame(preparedCustomGameDictionary, () => 0)?.word === preparedCustomGameDictionary.secretWordPool[0]?.word, 'game adapter must pick deterministic secret when random is injected');
assert(getHintPoolForGame(preparedCustomGameDictionary).every(word => word.length === 5), 'game adapter hint pool must match active secret pool');

const preparedEmptyCustomGameDictionary = prepareGameDictionary({
  settings: { wordLength: 6, dictionarySource: 'custom', difficulty: 'ALL' },
  userProfile: { customDictionaryEn: ['cat', 'dog'] },
});
assert(Boolean(preparedEmptyCustomGameDictionary.errorMessage), 'game adapter must expose explicit empty custom dictionary message');

assert(getGuessTranslationForGame('able'), 'game adapter translation lookup must work for built-in guesses');
assert(getTranslationForWord('able'), 'translation lookup must work case-insensitively for built-in words');
assert(COMMON_WORDS_EN.length === initialCommonCount, 'dictionary engine must not mutate COMMON_WORDS_EN');
assert(ALL_WORDS_EN.length === initialAllWordsCount, 'dictionary engine must not mutate ALL_WORDS_EN');

console.log(JSON.stringify({
  ok: true,
  checked: 'dictionary-engine-game-adapter-upload-and-profile-normalization',
  counts: {
    commonWords: COMMON_WORDS_EN.length,
    allWords: ALL_WORDS_EN.length,
    builtinFiveA1: builtinFiveA1.length,
    normalizedCustom: normalizedCustom.length,
    uploadImported: uploadResult.diagnostics.importedCount,
    largeUploadImported: largeUploadResult.diagnostics.importedCount,
    customFive: customFive.length,
    validationFive: validationFive.length,
    gameSecretPool: preparedCustomGameDictionary.secretWordPool.length,
    gameValidationPool: preparedCustomGameDictionary.validationPool.length,
    profileDictionary: dirtyProfile.customDictionaryEn.length,
  },
}, null, 2));
