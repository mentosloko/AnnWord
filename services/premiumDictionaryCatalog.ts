import { EnrichedWord, UserProfile } from '../types';
import business from '../dictionaries/premium/premium_business_english.json';
import travel from '../dictionaries/premium/premium_travel_english.json';
import medicine from '../dictionaries/premium/premium_medical_english.json';
import academic from '../dictionaries/premium/premium_ielts_academic.json';
import it from '../dictionaries/premium/premium_it_digital.json';
import finance from '../dictionaries/premium/premium_finance_banking.json';
import legal from '../dictionaries/premium/premium_legal_compliance.json';
import science from '../dictionaries/premium/premium_science_research.json';
import everyday from '../dictionaries/premium/premium_everyday_advanced.json';
import food from '../dictionaries/premium/premium_food_hospitality.json';
import index from '../dictionaries/premium/premium_dictionaries.index.json';

export type PremiumDictionaryId =
  | 'premium_business_english'
  | 'premium_travel_english'
  | 'premium_medical_english'
  | 'premium_ielts_academic'
  | 'premium_it_digital'
  | 'premium_finance_banking'
  | 'premium_legal_compliance'
  | 'premium_science_research'
  | 'premium_everyday_advanced'
  | 'premium_food_hospitality';

export interface PremiumDictionaryMeta {
  id: PremiumDictionaryId;
  title: string;
  shortTitle: string;
  theme: string;
  icon: string;
  wordCount: number;
}

type PremiumDictionaryFile = {
  title: string;
  source: 'topic';
  theme: string;
  words: string[];
};

const dictionaryFiles: Record<PremiumDictionaryId, PremiumDictionaryFile> = {
  premium_business_english: business as PremiumDictionaryFile,
  premium_travel_english: travel as PremiumDictionaryFile,
  premium_medical_english: medicine as PremiumDictionaryFile,
  premium_ielts_academic: academic as PremiumDictionaryFile,
  premium_it_digital: it as PremiumDictionaryFile,
  premium_finance_banking: finance as PremiumDictionaryFile,
  premium_legal_compliance: legal as PremiumDictionaryFile,
  premium_science_research: science as PremiumDictionaryFile,
  premium_everyday_advanced: everyday as PremiumDictionaryFile,
  premium_food_hospitality: food as PremiumDictionaryFile,
};

const normalizedWord = (word: string): string => word.trim().toUpperCase().replace(/[^A-Z]/g, '');

export const hasPremiumDictionaryAccess = (userProfile: UserProfile): boolean => {
  if (userProfile.role === 'admin') return true;
  if (userProfile.subscriptionTier !== 'premium') return false;
  if (userProfile.premiumExpiresAt && Date.parse(userProfile.premiumExpiresAt) <= Date.now()) return false;
  return userProfile.featureFlags?.premiumDictionaries === true;
};

export const getPremiumDictionaryCatalog = (): PremiumDictionaryMeta[] => {
  const items = (index as { dictionaries: Array<Omit<PremiumDictionaryMeta, 'wordCount'>> }).dictionaries;
  return items.map(item => ({
    ...item,
    id: item.id as PremiumDictionaryId,
    wordCount: dictionaryFiles[item.id as PremiumDictionaryId]?.words.length || 0,
  }));
};

export const getDefaultPremiumDictionaryId = (): PremiumDictionaryId => 'premium_business_english';

export const getPremiumDictionaryMeta = (id?: string): PremiumDictionaryMeta => {
  const catalog = getPremiumDictionaryCatalog();
  return catalog.find(item => item.id === id) || catalog[0];
};

export const getPremiumDictionaryWords = (id?: string): string[] => {
  const dictionaryId = (dictionaryFiles[id as PremiumDictionaryId] ? id : getDefaultPremiumDictionaryId()) as PremiumDictionaryId;
  const seen = new Set<string>();
  return dictionaryFiles[dictionaryId].words
    .map(normalizedWord)
    .filter(word => {
      if (!/^[A-Z]{4,6}$/.test(word) || seen.has(word)) return false;
      seen.add(word);
      return true;
    });
};

export const getPremiumDictionaryEntries = (id?: string): EnrichedWord[] =>
  getPremiumDictionaryWords(id).map(word => ({ word, translation: word, level: 'Premium' }));
