import { supabase } from '../supabase';
import { AccountRole, FeatureFlags, SubscriptionTier } from '../types';

export interface AdminRcProfile {
  id: string;
  username: string;
  role: AccountRole;
  subscriptionTier: SubscriptionTier;
  featureFlags: FeatureFlags;
}

export interface AdminPremiumGrantResult {
  id: string;
  username: string;
  subscriptionTier: SubscriptionTier;
  premiumExpiresAt?: string;
}