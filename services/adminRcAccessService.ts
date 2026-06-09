import { supabase } from '../supabase';
import { AccountRole, FeatureFlags, SubscriptionTier } from '../types';

export interface AdminRcProfile { id: string; username: string; role: AccountRole; subscriptionTier: SubscriptionTier; featureFlags: FeatureFlags; }
export interface AdminPremiumGrantResult { id: string; username: string; subscriptionTier: SubscriptionTier; premiumExpiresAt?: string; }
const normalizeFlags = (value: unknown): FeatureFlags => { const flags = (value && typeof value === 'object') ? value as Record<string, unknown> : {}; return { adultRoom: flags.adultRoom === true, premiumDictionaries: flags.premiumDictionaries === true, dailyWorldReward: flags.dailyWorldReward === true, treatRequests: flags.treatRequests === true, streakStickers: flags.streakStickers === true, levelWardrobe: flags.levelWardrobe === true }; };
export const RC_FEATURE_LABELS: Array<{ key: keyof FeatureFlags; label: string }> =