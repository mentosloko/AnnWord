import type { EnrichedWord } from '../types';
import { getAllKidsDictionaryEntries } from './kidsDictionaryCatalog';
import { hasRussianTranslation, normalizeWord } from './wordNormalization';

export type DictionaryTranslationMap = Record<string, string>;

export interface DictionaryTranslationResolution {
  translations: DictionaryTranslationMap;
  readyWords: string[];
  canonicalWords: string[];
  manualWords: string[];
  missingWords: string[];
}

let masterTranslationsPromise: Promise<Map<string, string>> | null = null;

const normalizeTranslations = (value: unknown): DictionaryTranslationMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: DictionaryTranslationMap = {};
  Object.entries(value as Record<string, unknown>).forEach(([rawWord, rawTranslation]) => {
    const word = normalizeWord(rawWord);
    const translation = typeof rawTranslation === 'string' ? rawTranslation.trim() : '';
    if (word && hasRussianTranslation(translation)) normalized[word] = translation;
  });
  return normalized;
};

const addEntries = (target: Map<string, string>, entries: EnrichedWord[]): void => {
  entries.forEach(entry => {
    const word = normalizeWord(entry.word);
    const translation = entry.translation?.trim();
    if (word && hasRussianTranslation(translation)) target.set(word, translation);
  });
};

/**
 * Loads the canonical translation index lazily so server cold starts do not pay
 * the cost of importing the large general dictionary unless a dictionary is
 * actually being saved or assigned. Kids entries are applied last because they
 * contain the school-friendly translations used by AnnWord Kids.
 */
export const loadMasterDictionaryTranslations = async (): Promise<Map<string, string>> => {
  if (!masterTranslationsPromise) {
    masterTranslationsPromise = import('../dictionaries/english')
      .then(({ COMMON_WORDS_EN }) => {
        const translations = new Map<string, string>();
        addEntries(translations, COMMON_WORDS_EN);
        addEntries(translations, getAllKidsDictionaryEntries());
        return translations;
      })
      .catch(error => {
        masterTranslationsPromise = null;
        throw error;
      });
  }
  return masterTranslationsPromise;
};

export const resolveDictionaryWordTranslations = async (
  words: string[] = [],
  providedTranslations: unknown = {},
): Promise<DictionaryTranslationResolution> => {
  const master = await loadMasterDictionaryTranslations();
  const provided = normalizeTranslations(providedTranslations);
  const seen = new Set<string>();
  const translations: DictionaryTranslationMap = {};
  const readyWords: string[] = [];
  const canonicalWords: string[] = [];
  const manualWords: string[] = [];
  const missingWords: string[] = [];

  words.forEach(rawWord => {
    const word = normalizeWord(rawWord);
    if (!word || seen.has(word)) return;
    seen.add(word);
    const canonicalTranslation = master.get(word);
    if (canonicalTranslation && hasRussianTranslation(canonicalTranslation)) {
      translations[word] = canonicalTranslation;
      readyWords.push(word);
      canonicalWords.push(word);
      return;
    }
    const manualTranslation = provided[word];
    if (manualTranslation && hasRussianTranslation(manualTranslation)) {
      translations[word] = manualTranslation;
      readyWords.push(word);
      manualWords.push(word);
      return;
    }
    missingWords.push(word);
  });

  return { translations, readyWords, canonicalWords, manualWords, missingWords };
};

export const getCanonicalTranslation = async (word: string): Promise<string | null> => {
  const normalized = normalizeWord(word);
  if (!normalized) return null;
  return (await loadMasterDictionaryTranslations()).get(normalized) || null;
};

export const normalizeDictionaryTranslations = normalizeTranslations;

export const resetMasterDictionaryLookupForTests = (): void => {
  masterTranslationsPromise = null;
};
