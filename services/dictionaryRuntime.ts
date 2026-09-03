import type { EnrichedWord } from '../types';
import { type PremiumDictionaryId } from './premiumDictionaryCatalog';
import { ensureSpotlightDictionaryLoaded, resetSpotlightDictionaryForTests, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from './spotlightDictionary';

export type PremiumDictionaryWord = string | {
  word: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  translation?: string;
};

export type PremiumDictionaryFile = {
  title: string;
  source: 'topic';
  theme: string;
  words: PremiumDictionaryWord[];
};

export type GeneralDictionaryData = {
  ALL_WORDS_EN: string[];
  COMMON_WORDS_EN: EnrichedWord[];
};

type StandardPremiumDictionaryId = Exclude<PremiumDictionaryId, typeof SPOTLIGHT_PREMIUM_DICTIONARY_ID>;

let generalDictionary: GeneralDictionaryData | null = null;
let generalPromise: Promise<GeneralDictionaryData> | null = null;
const premiumDictionaries = new Map<StandardPremiumDictionaryId, PremiumDictionaryFile>();
const premiumPromises = new Map<StandardPremiumDictionaryId, Promise<PremiumDictionaryFile>>();

const premiumLoaders: Record<StandardPremiumDictionaryId, () => Promise<PremiumDictionaryFile>> = {
  premium_business_english: () => import('../dictionaries/premium/premium_business_english.json').then(module => module.default as PremiumDictionaryFile),
  premium_travel_english: () => import('../dictionaries/premium/premium_travel_english.json').then(module => module.default as PremiumDictionaryFile),
  premium_medical_english: () => import('../dictionaries/premium/premium_medical_english.json').then(module => module.default as PremiumDictionaryFile),
  premium_ielts_academic: () => import('../dictionaries/premium/premium_ielts_academic.json').then(module => module.default as PremiumDictionaryFile),
  premium_it_digital: () => import('../dictionaries/premium/premium_it_digital.json').then(module => module.default as PremiumDictionaryFile),
  premium_finance_banking: () => import('../dictionaries/premium/premium_finance_banking.json').then(module => module.default as PremiumDictionaryFile),
  premium_legal_compliance: () => import('../dictionaries/premium/premium_legal_compliance.json').then(module => module.default as PremiumDictionaryFile),
  premium_science_research: () => import('../dictionaries/premium/premium_science_research.json').then(module => module.default as PremiumDictionaryFile),
  premium_everyday_advanced: () => import('../dictionaries/premium/premium_everyday_advanced.json').then(module => module.default as PremiumDictionaryFile),
  premium_food_hospitality: () => import('../dictionaries/premium/premium_food_hospitality.json').then(module => module.default as PremiumDictionaryFile),
};

const isStandardPremiumDictionaryId = (id?: string): id is StandardPremiumDictionaryId =>
  Object.prototype.hasOwnProperty.call(premiumLoaders, id || '');

export const resolvePremiumDictionaryId = (id?: string): PremiumDictionaryId | null => {
  if (id === SPOTLIGHT_PREMIUM_DICTIONARY_ID) return SPOTLIGHT_PREMIUM_DICTIONARY_ID;
  return isStandardPremiumDictionaryId(id) ? id : null;
};

export const ensureGeneralDictionaryLoaded = async (): Promise<GeneralDictionaryData> => {
  if (generalDictionary) return generalDictionary;
  if (!generalPromise) {
    generalPromise = import('../dictionaries/mainEnglish')
      .then(module => {
        generalDictionary = {
          ALL_WORDS_EN: module.ALL_WORDS_EN,
          COMMON_WORDS_EN: module.COMMON_WORDS_EN,
        };
        return generalDictionary;
      })
      .catch(error => {
        generalPromise = null;
        throw error;
      });
  }
  return generalPromise;
};

export const ensurePremiumDictionaryLoaded = async (id?: string): Promise<PremiumDictionaryFile> => {
  const resolvedId = resolvePremiumDictionaryId(id);
  if (!resolvedId) throw new Error('Неизвестный тематический словарь. Выберите словарь заново.');
  if (resolvedId === SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
    throw new Error('Spotlight загружается через отдельный школьный словарь.');
  }
  const dictionaryId = resolvedId as StandardPremiumDictionaryId;
  const cached = premiumDictionaries.get(dictionaryId);
  if (cached) return cached;
  const pending = premiumPromises.get(dictionaryId);
  if (pending) return pending;
  const promise = premiumLoaders[dictionaryId]()
    .then(file => {
      premiumDictionaries.set(dictionaryId, file);
      premiumPromises.delete(dictionaryId);
      return file;
    })
    .catch(error => {
      premiumPromises.delete(dictionaryId);
      throw error;
    });
  premiumPromises.set(dictionaryId, promise);
  return promise;
};

export const ensureDictionaryRuntime = async (premiumDictionaryId?: string | null): Promise<void> => {
  const tasks: Promise<unknown>[] = [ensureGeneralDictionaryLoaded()];
  if (premiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID) tasks.push(ensureSpotlightDictionaryLoaded());
  else if (premiumDictionaryId) tasks.push(ensurePremiumDictionaryLoaded(premiumDictionaryId));
  await Promise.all(tasks);
};

export const readGeneralDictionary = (): GeneralDictionaryData | null => generalDictionary;

export const readPremiumDictionary = (id?: string): PremiumDictionaryFile | null => {
  const resolvedId = resolvePremiumDictionaryId(id);
  if (!resolvedId || resolvedId === SPOTLIGHT_PREMIUM_DICTIONARY_ID) return null;
  return premiumDictionaries.get(resolvedId as StandardPremiumDictionaryId) || null;
};

export const resetDictionaryRuntimeForTests = (): void => {
  generalDictionary = null;
  generalPromise = null;
  premiumDictionaries.clear();
  premiumPromises.clear();
  resetSpotlightDictionaryForTests();
};
