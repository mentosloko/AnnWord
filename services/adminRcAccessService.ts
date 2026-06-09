import { supabase } from '../supabase';
import { AccountRole, FeatureFlags, SubscriptionTier } from '../types';

export interface AdminRcProfile {
  id: string;
  username: string;
  role: AccountRole;
  subscriptionTier: SubscriptionTier;
  featureFlags: FeatureFlags;
}

const normalizeFlags = (value: unknown): FeatureFlags => {
  const flags = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {