import { UserProfile } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const isPremiumActive = (userProfile: UserProfile): boolean => {
  if (userProfile.role === 'admin') return true;
  if (userProfile.subscriptionTier !== 'premium') return false;
  if (userProfile.premiumExpiresAt && Date.parse(userProfile.premiumExpiresAt) <= Date.now()) return false;
  return true;
};

export const hasPremiumDictionaries = (userProfile: UserProfile): boolean =>
  isPremiumActive(userProfile) && userProfile.featureFlags?.premiumDictionaries === true;

export const getTrialPremiumExpiresAt = (days = 7, now = new Date()): string =>
  new Date(now.getTime() + Math.max(1, Math.round(days)) * DAY_MS).toISOString();

export const formatPremiumExpiresAt = (expiresAt?: string): string => {
  if (!expiresAt) return 'без ограничения срока';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'без ограничения срока';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

export const formatPremiumAccessPeriod = (expiresAt?: string): string => {
  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) return 'без ограничения срока';
  return `до ${formatPremiumExpiresAt(expiresAt)}`;
};
