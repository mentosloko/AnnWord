import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../dictionaries/english';
import { DifficultyLevel, DictionarySource, EnrichedWord, WordLength } from '../types';

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

const BUILTIN_WORD_SET = new Set(ALL_WORDS_EN.map(normalizeWord).filter(Boolean));

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

export const getCustomWordsAvailableInBuiltinDictionary = (words: string[] = []): string[] =>
  normalizeCustomDictionary(words).filter(word => BUILTIN_WORD_SET.has(word));

export const toCustomEnrichedWords = (words: string[] = []): EnrichedWord[] =>
  getCustomWordsAvailableInBuiltinDictionary(words).map(word => ({ word, translation: '', level: CUSTOM_LEVEL }));

export const isAllowedSecretWord = (word: string): boolean => {
  const clean = normalizeWord(word);
  return Boolean(clean) && (!clean.endsWith('S') || clean.endsWith('SS'));
};

export const getBuiltinSecretWordPool = (selection: Pick<DictionarySelection, 'wordLength' | 'difficulty'>): EnrichedWord[] => {
  let pool = COMMON_WORDS_EN.map(item => ({ ...item, word: normalizeWord(item.word) }));
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
  const builtin = ALL_WORDS_EN.map(normalizeWord).filter(word => word.length === selection.wordLength);
  const custom = getCustomWordsAvailableInBuiltinDictionary(selection.customDictionaryEn).filter(word => word.length === selection.wordLength);
  const extras = EXTRA_VALID_GUESSES.filter(word => word.length === selection.wordLength);
  return Array.from(new Set([...builtin, ...custom, ...extras]));
};

export const buildDictionaryPools = (selection: DictionarySelection): DictionaryPools => {
  const customDictionaryNormalized = normalizeCustomDictionary(selection.customDictionaryEn);
  const effectiveSource: DictionarySource = selection.source === 'custom' && customDictionaryNormalized.length > 0 ? 'custom' : 'builtin';
  return { secretWordPool: getSecretWordPool(selection), validationPool: getValidationPool(selection), customDictionaryNormalized, dictionarySourceUsed: effectiveSource };
};

export const getTranslationForWord = (word: string): string | null => {
  const clean = normalizeWord(word);
  const found = COMMON_WORDS_EN.find(item => normalizeWord(item.word) === clean);
  return found?.translation ?? null;
};

export const getDictionaryEmptyStateMessage = (selection: DictionarySelection): string => {
  if (selection.source === 'custom') return `В вашем словаре нет слов длиной ${selection.wordLength}.`;
  return `В словаре нет слов уровня ${selection.difficulty} длиной ${selection.wordLength}.`;
};

export const pickRandomSecretWord = (pool: EnrichedWord[], random: () => number = Math.random): EnrichedWord | null => {
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)] ?? null;
};