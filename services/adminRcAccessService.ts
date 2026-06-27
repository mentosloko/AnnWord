import { AccountRole, FeatureFlags, SubscriptionTier } from '../types';

export interface AdminRcProfile {
  id: string;
  username: string;
  role: AccountRole;
  subscriptionTier: SubscriptionTier;
  featureFlags: FeatureFlags;
}

export const RC_FEATURE_LABELS: Array<{ key: keyof FeatureFlags; label: string }> = [];

export const adminRcAccessService = {
  async listProfiles(): Promise<AdminRcProfile[]> {
    return [];
  },
};
