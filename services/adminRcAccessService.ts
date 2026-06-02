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
  const flags = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  return {
    adultRoom: flags.adultRoom === true,
    premiumDictionaries: flags.premiumDictionaries === true,
    dailyWorldReward: flags.dailyWorldReward === true,
    treatRequests: flags.treatRequests === true,
    streakStickers: flags.streakStickers === true,
    levelWardrobe: flags.levelWardrobe === true,
  };
};

export const RC_FEATURE_LABELS: Array<{ key: keyof FeatureFlags; label: string }> = [
  { key: 'adultRoom', label: 'Комната взрослого' },
  { key: 'premiumDictionaries', label: 'Premium-словари и OCR' },
  { key: 'dailyWorldReward', label: 'Фон дня за задание' },
  { key: 'treatRequests', label: 'Просьбы лакомства' },
  { key: 'streakStickers', label: 'Наклейки за серию' },
  { key: 'levelWardrobe', label: 'Уровни гардероба' },
];

export const adminRcAccessService = {
  async listProfiles(): Promise<AdminRcProfile[]> {
    const { data, error } = await supabase.rpc('admin_list_rc_profiles');
    if (error) throw error;
    return ((data || []) as Array<Record<string, unknown>>).map(row => ({
      id: String(row.id),
      username: String(row.username || 'Без имени'),
      role: (['admin', 'parent', 'teacher'].includes(String(row.role)) ? row.role : 'user') as AccountRole,
      subscriptionTier: row.subscription_tier === 'premium' ? 'premium' : 'free',
      featureFlags: normalizeFlags(row.feature_flags),
    }));
  },

  async setAccess(username: string, role: AccountRole, premium: boolean, featureFlags: FeatureFlags): Promise<void> {
    const { error } = await supabase.rpc('admin_set_rc_access', {
      p_username: username,
      p_role: role,
      p_premium: premium,
      p_feature_flags: featureFlags,
    });
    if (error) throw error;
  },

  async linkLearner(adultUsername: string, learnerUsername: string, relationRole: 'parent' | 'teacher', classLabel?: string): Promise<void> {
    const { error } = await supabase.rpc('admin_link_learner', {
      p_adult_username: adultUsername,
      p_learner_username: learnerUsername,
      p_relation_role: relationRole,
      p_class_label: classLabel || null,
    });
    if (error) throw error;
  },
};
