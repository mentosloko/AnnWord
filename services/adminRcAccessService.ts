import { supabase } from '../supabase';
import { AccountRole, FeatureFlags, SubscriptionTier } from '../types';

export interface AdminRcProfile {
  id: string;
  username: string;
  role: AccountRole;
  subscriptionTier: SubscriptionTier;
  featureFlags: FeatureFlags;
}

export const RC_FEATURE_LABELS: Array<{ key: keyof FeatureFlags; label: string }> = [
  { key: 'adultRoom', label: 'Кабинет взрослого' },
  { key: 'premiumDictionaries', label: 'Премиум-словари' },
  { key: 'dailyWorldReward', label: 'Ежедневные награды' },
  { key: 'treatRequests', label: 'Запросы лакомств' },
  {