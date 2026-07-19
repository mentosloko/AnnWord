import { DifficultyLevel, UserProfile } from '../types';

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

const catalog: PremiumDictionaryMeta[] = [
  { id: 'premium_business_english', title: 'Business English', shortTitle: 'Business', theme: 'business', icon: '💼' },
  { id: 'premium_travel_english', title: 'Travel English', shortTitle: 'Travel', theme: 'travel', icon: '✈️' },
  { id: 'premium_medical_english', title: 'Medical English', shortTitle: 'Medicine', theme: 'medicine', icon: '🩺' },
  { id: 'premium_ielts_academic', title: 'IELTS / Academic English', shortTitle: 'IELTS', theme: 'academic', icon: '🎓' },
  { id: 'premium_it_digital', title: 'IT & Digital English', shortTitle: 'IT & Digital', theme: 'it', icon: '💻' },
  { id: 'premium_finance_banking', title: 'Finance & Banking English', shortTitle: 'Finance', theme: 'finance', icon: '🏦' },
  { id: 'premium_legal_compliance', title: 'Legal & Compliance English', shortTitle: 'Legal', theme: 'legal', icon: '⚖️' },
  { id: 'premium_science_research', title: 'Science & Research English', shortTitle: 'Science', theme: 'science', icon: '🔬' },
  { id: 'premium_everyday_advanced', title: 'Everyday Advanced English', shortTitle: 'Everyday+', theme: 'everyday_advanced', icon: '💬' },
  { id: 'premium_food_hospitality', title: 'Food & Hospitality English', shortTitle: 'Food', theme: 'food_hospitality', icon: '🍽️' },
];

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
