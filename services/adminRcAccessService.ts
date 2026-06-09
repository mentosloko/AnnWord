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
  { key: 'streakStickers', label: 'Стикеры за серии' },
  { key: 'levelWardrobe', label: 'Предметы по уровням' }
];

type ProfileRow = {
  id: string;
  username: string | null;
  role: AccountRole | null;
  subscription_tier: SubscriptionTier | null;
  feature_flags: FeatureFlags | null;
};

const normalizeProfile = (row: ProfileRow): AdminRcProfile => ({
  id: row.id,
  username: row.username || 'Без имени',
  role: row.role || 'user',
  subscriptionTier: row.subscription_tier || 'free',
  featureFlags: row.feature_flags || {}
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
};

const findProfileIdByUsername = async (username: string): Promise<string> => {
  const normalized = username.trim();

  if (!normalized) {
    throw new Error('Укажите имя профиля.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(getErrorMessage(error, 'Не удалось найти профиль.'));
  }

  if (!data?.id) {
    throw new Error(`Профиль ${normalized} не найден.`);
  }

  return data.id;
};

export const adminRcAccessService = {
  async listProfiles(): Promise<AdminRcProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, subscription_tier, feature_flags')
      .order('username', { ascending: true });

    if (error) {
      throw new Error(getErrorMessage(error, 'Не удалось загрузить профили.'));
    }

    return ((data || []) as ProfileRow[]).map(normalizeProfile);
  },

  async setAccess(
    username: string,
    role: AccountRole,
    premium: boolean,
    featureFlags: FeatureFlags
  ): Promise<void> {
    const normalized = username.trim();

    if (!normalized) {
      throw new Error('Выберите профиль.');
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role,
        subscription_tier: premium ? 'premium' : 'free',
        feature_flags: featureFlags || {}
      })
      .eq('username', normalized);

    if (error) {
      throw new Error(getErrorMessage(error, 'Не удалось сохранить доступ.'));
    }
  },

  async linkLearner(
    adultUsername: string,
    learnerUsername: string,
    relationRole: 'parent' | 'teacher',
    classLabel?: string
  ): Promise<void> {
    const adultUserId = await findProfileIdByUsername(adultUsername);
    const learnerUserId = await findProfileIdByUsername(learnerUsername);

    const { error } = await supabase
      .from('adult_learner_links')
      .upsert({
        adult_user_id: adultUserId,
        learner_user_id: learnerUserId,
        relation_role: relationRole,
        class_label: classLabel?.trim() || null
      }, {
        onConflict: 'adult_user_id,learner_user_id'
      });

    if (error) {
      throw new Error(getErrorMessage(error, 'Не удалось связать взрослого и ребёнка.'));
    }
  }
};

export default adminRcAccessService;
