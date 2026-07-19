import { DifficultyLevel, UserProfile } from '../types';
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
  wordCount?: number;
  levelCounts?: Partial<Record<DifficultyLevel, number>>;
}

type PremiumDictionaryIndexItem = Omit<PremiumDictionaryMeta, 'id' | 'wordCount' | 'levelCounts'> & {
  id: string;
  file?: string;
};

const catalog: PremiumDictionaryMeta[] = (index as { dictionaries: PremiumDictionaryIndexItem[] }).dictionaries.map(item => ({
  id: item.id as PremiumDictionaryId,
  title: item.title,
  shortTitle: item.shortTitle,
  theme: item.theme,
  icon: item.icon,
}));

export const hasPremiumDictionaryAccess = (userProfile: UserProfile): boolean => {
  if (userProfile.role === 'admin') return true;
  if (userProfile.subscriptionTier !== 'premium') return false;
  if (userProfile.premiumExpiresAt && Date.parse(userProfile.premiumExpiresAt) <= Date.now()) return false;
  return userProfile.featureFlags?.premiumDictionaries === true;
};

export const getPremiumDictionaryCatalog = (): PremiumDictionaryMeta[] => catalog;

export const getDefaultPremiumDictionaryId = (): PremiumDictionaryId => 'premium_business_english';

export const getPremiumDictionaryMeta = (id?: string): PremiumDictionaryMeta =>
  catalog.find(item => item.id === id) || catalog[0];
