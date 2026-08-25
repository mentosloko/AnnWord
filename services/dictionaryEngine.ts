import { DifficultyLevel, DictionarySource, EnrichedWord, WordLength } from '../types';
import { readGeneralDictionary } from './dictionaryRuntime';
import { hasRussianTranslation, normalizeCustomDictionary, normalizeWord } from './wordNormalization';
import { isBlacklistedWord } from './wordBlacklist';

export { hasRussianTranslation, normalizeCustomDictionary, normalizeWord } from './wordNormalization';

export interface DictionarySelection {
  source: DictionarySource;
  wordLength: WordLength;
  difficulty: DifficultyLevel;
  customDictionaryEn?: string[];
}

export interface DictionaryPools {
  secretWordPool: EnrichedWord[];
  validationPool: string[];
  customDictionaryNormalized: string[];
  dictionarySourceUsed: DictionarySource;
}

const CUSTOM_LEVEL = 'Custom';
const EXTRA_VALID_GUESSES = ['MEOW', 'WOOF'];
let translatedSource: EnrichedWord[] | null = null;
let translatedWordByKey = new Map<string, EnrichedWord>();

const getTranslatedWordByKey = (): Map<string, EnrichedWord> => {
  const source = readGeneralDictionary()?.COMMON_WORDS_EN || [];
  if (source === translatedSource) return translatedWordByKey;
  translatedSource = source;
  translatedWordByKey = new Map(
    source
      .filter(item => hasRussianTranslation(item.translation))
      .filter(item => !isBlacklistedWord(item.word))
      .map(item => [normalizeWord(item.word), { ...item, word: normalizeWord(item.word) }]),
  );
  return translatedWordByKey;
};

const explicitTranslationFor = (word: string, translations: Record<string, string> = {}): string | null => {
  const direct = translations[word] || translations[normalizeWord(word)];
  return hasRussianTranslation(direct) ? direct.trim() : null;
};

/** Playable custom words need either a built-in translation or an explicit validated translation. */
export const getCustomWordsAvailableInBuiltinDictionary = (words: string[] = [], explicitTranslations: Record<string, string> = {}): string[] => {
  const translated = getTranslatedWordByKey();
  return normalizeCustomDictionary(words).filter(word => (translated.has(word) || explicitTranslationFor(word, explicitTranslations)) && !isBlacklistedWord(word));
};

export const getCustomWordsMissingTranslation = (words: string[] = [], explicitTranslations: Record<string, string> = {}): string[] => {
  const translated = getTranslatedWordByKey();
  return normalizeCustomDictionary(words).filter(word => !translated.has(word) && !explicitTranslationFor(word, explicitTranslations) && !isBlacklistedWord(word));
};

export const toCustomEnrichedWords = (words: string[] = [], explicitTranslations: Record<string, string> = {}): EnrichedWord[] => {
  const translated = getTranslatedWordByKey();
  return getCustomWordsAvailableInBuiltinDictionary(words, explicitTranslations)
    .map(word => translated.get(word) || {
      word,
      translation: explicitTranslationFor(word, explicitTranslations) || '',
      level: CUSTOM_LEVEL,
    })
    .filter((entry): entry is EnrichedWord => Boolean(entry) && hasRussianTranslation(entry.translation))
    .map(entry => ({ ...entry, level: CUSTOM_LEVEL }));
};

export const isAllowedValidationWord = (word: string): boolean => {
  const clean = normalizeWord(word);
  return Boolean(clean) && !isBlacklistedWord(clean);
};

export const isAllowedSecretWord = (word: string): boolean => {
  const clean = normalizeWord(word);
  return isAllowedValidationWord(clean) && (!clean.endsWith('S') || clean.endsWith('SS'));
};

export const getBuiltinSecretWordPool = (selection: Pick<DictionarySelection, 'wordLength' | 'difficulty'>): EnrichedWord[] => {
  let pool = (readGeneralDictionary()?.COMMON_WORDS_EN || [])
    .filter(item => hasRussianTranslation(item.translation))
    .map(item => ({ ...item, word: normalizeWord(item.word) }))
    .filter(item => !isBlacklistedWord(item.word));
  if (selection.difficulty !== 'ALL') pool = pool.filter(item => item.level === selection.difficulty);
  return pool.filter(item => item.word.length === selection.wordLength && isAllowedSecretWord(item.word));
};

export const getCustomSecretWordPool = (customWords: string[] = [], wordLength: WordLength, explicitTranslations: Record<string, string> = {}): EnrichedWord[] =>
  toCustomEnrichedWords(customWords, explicitTranslations).filter(item => item.word.length === wordLength && isAllowedSecretWord(item.word));

export const getSecretWordPool = (selection: DictionarySelection): EnrichedWord[] => {
  if (selection.source === 'custom' && normalizeCustomDictionary(selection.customDictionaryEn).length > 0) return getCustomSecretWordPool(selection.customDictionaryEn, selection.wordLength);
  return getBuiltinSecretWordPool(selection);
};

export const getValidationPool = (selection: Pick<DictionarySelection, 'wordLength' | 'customDictionaryEn'>): string[] => {
  const builtin = (readGeneralDictionary()?.ALL_WORDS_EN || []).map(normalizeWord).filter(word => word.length === selection.wordLength && isAllowedValidationWord(word));
  const custom = getCustomWordsAvailableInBuiltinDictionary(selection.customDictionaryEn).filter(word => word.length === selection.wordLength && isAllowedValidationWord(word));
  const extras = EXTRA_VALID_GUESSES.filter(word => word.length === selection.wordLength && isAllowedValidationWord(word));
  return Array.from(new Set([...builtin, ...custom, ...extras]));
};

export const buildDictionaryPools = (selection: DictionarySelection): DictionaryPools => {
  const customDictionaryNormalized = normalizeCustomDictionary(selection.customDictionaryEn);
  const effectiveSource: DictionarySource = selection.source === 'custom' && customDictionaryNormalized.length > 0 ? 'custom' : 'builtin';
  return { secretWordPool: getSecretWordPool(selection), validationPool: getValidationPool(selection), customDictionaryNormalized, dictionarySourceUsed: effectiveSource };
};

export const getTranslationForWord = (word: string): string | null =>
  getTranslatedWordByKey().get(normalizeWord(word))?.translation ?? null;

export const getDictionaryEmptyStateMessage = (selection: DictionarySelection): string => {
  if (selection.source === 'custom') return `В вашем словаре нет слов длиной ${selection.wordLength}.`;
  return `В словаре нет слов уровня ${selection.difficulty} длиной ${selection.wordLength}.`;
};

export const pickRandomSecretWord = (pool: EnrichedWord[], random: () => number = Math.random): EnrichedWord | null => {
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)] ?? null;
};
