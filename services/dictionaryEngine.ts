import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../dictionaries/mainEnglish';
import { DifficultyLevel, DictionarySource, EnrichedWord, WordLength } from '../types';
import { isBlacklistedWord } from './wordBlacklist';

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

export const normalizeWord = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z]/g, '');

export const hasRussianTranslation = (translation: string | undefined | null): boolean =>
  Boolean(translation && /[А-Яа-яЁё]/.test(translation));

const TRANSLATED_WORD_BY_KEY = new Map(
  COMMON_WORDS_EN
    .filter(item => hasRussianTranslation(item.translation))
    .filter(item => !isBlacklistedWord(item.word))
    .map(item => [normalizeWord(item.word), { ...item, word: normalizeWord(item.word) }]),
);

export const normalizeCustomDictionary = (words: string[] = []): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const word of words) {
    const clean = normalizeWord(word);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }
  return normalized;
};

/** Playable custom words must have a real Russian translation in the common dictionary and must not be blacklisted. */
export const getCustomWordsAvailableInBuiltinDictionary = (words: string[] = []): string[] =>
  normalizeCustomDictionary(words).filter(word => TRANSLATED_WORD_BY_KEY.has(word) && !isBlacklistedWord(word));

export const getCustomWordsMissingTranslation = (words: string[] = []): string[] =>
  normalizeCustomDictionary(words).filter(word => !TRANSLATED_WORD_BY_KEY.has(word) && !isBlacklistedWord(word));

export const toCustomEnrichedWords = (words: string[] = []): EnrichedWord[] =>
  getCustomWordsAvailableInBuiltinDictionary(words)
    .map(word => TRANSLATED_WORD_BY_KEY.get(word))
    .filter((entry): entry is EnrichedWord => Boolean(entry))
    .map(entry => ({ ...entry, level: CUSTOM_LEVEL }));

export const isAllowedValidationWord = (word: string): boolean => {
  const clean = normalizeWord(word);
  return Boolean(clean) && !isBlacklistedWord(clean);
};

export const isAllowedSecretWord = (word: string): boolean => {
  const clean = normalizeWord(word);
  return isAllowedValidationWord(clean) && (!clean.endsWith('S') || clean.endsWith('SS'));
};

export const getBuiltinSecretWordPool = (selection: Pick<DictionarySelection, 'wordLength' | 'difficulty'>): EnrichedWord[] => {
  let pool = COMMON_WORDS_EN
    .filter(item => hasRussianTranslation(item.translation))
    .map(item => ({ ...item, word: normalizeWord(item.word) }))
    .filter(item => !isBlacklistedWord(item.word));
  if (selection.difficulty !== 'ALL') pool = pool.filter(item => item.level === selection.difficulty);
  return pool.filter(item => item.word.length === selection.wordLength && isAllowedSecretWord(item.word));
};

export const getCustomSecretWordPool = (customWords: string[] = [], wordLength: WordLength): EnrichedWord[] =>
  toCustomEnrichedWords(customWords).filter(item => item.word.length === wordLength && isAllowedSecretWord(item.word));

export const getSecretWordPool = (selection: DictionarySelection): EnrichedWord[] => {
  if (selection.source === 'custom' && normalizeCustomDictionary(selection.customDictionaryEn).length > 0) return getCustomSecretWordPool(selection.customDictionaryEn, selection.wordLength);
  return getBuiltinSecretWordPool(selection);
};

export const getValidationPool = (selection: Pick<DictionarySelection, 'wordLength' | 'customDictionaryEn'>): string[] => {
  const builtin = ALL_WORDS_EN.map(normalizeWord).filter(word => word.length === selection.wordLength && isAllowedValidationWord(word));
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
  TRANSLATED_WORD_BY_KEY.get(normalizeWord(word))?.translation ?? null;

export const getDictionaryEmptyStateMessage = (selection: DictionarySelection): string => {
  if (selection.source === 'custom') return `В вашем словаре нет слов длиной ${selection.wordLength}.`;
  return `В словаре нет слов уровня ${selection.difficulty} длиной ${selection.wordLength}.`;
};

export const pickRandomSecretWord = (pool: EnrichedWord[], random: () => number = Math.random): EnrichedWord | null => {
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)] ?? null;
};
