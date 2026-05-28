import { UserProfile, UserStats, PetState, ShopItem } from "../types";
import { supabase } from "../supabase";
import { mapProfileFromDB, normalizeDictionaryField, normalizePet, normalizeStats } from "./profileMapper";
import { applyPurchaseLocally } from "./economyEngine";
import { QueuedAnalyticsEvent } from "./analyticsService";

const PROFILE_COLUMNS = 'id, username, role, custom_dictionary_en, stats, pet, coins, inventory';

const DEFAULT_PET: PetState = {
  name: 'Щенок',
  type: 'Puppy',
  level: 1,
  mood: 'happy',
  xp: 0,
  moodScore: 60,
  stage: 'stage_1',
  characterOnboarded: false,
  hunger: 60,
  energy: 60,
  equippedAccessories: []
};

const DEFAULT_STATS: UserStats = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} };

const toShopItemPayload = (item: ShopItem) => ({
  id: item.id,
  type: item.type,
  name: item.name,
  price: item.price,
  imageUrl: item.imageUrl || '',
  effect: item.effect || {},
  characterType: item.characterType || '',
});

const withTimeout = async (request: any, timeoutMs: number, label: string): Promise<any> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const userService = {
  getOrCreateProfile: async (userId: string, defaultUsername: string = 'Пользователь', email?: string): Promise<UserProfile> => {
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const role: 'admin' | 'user' = adminEmails.includes(email ?? '') ? 'admin' : 'user';

    try {
      const { data: profileData, error: fetchError } = await withTimeout(
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .maybeSingle(),
        3500,
        'profile fetch',
      );

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      if (profileData) return mapProfileFromDB(profileData);

      const newUserProfile = {
        id: userId,
        username: defaultUsername,
        role,
        custom_dictionary_en: [],
        stats: DEFAULT_STATS,
        pet: { ...DEFAULT_PET },
        coins: 5,
        inventory: []
      };

      const { data: insertedData, error: insertError } = await withTimeout(
        supabase
          .from('profiles')
          .insert([newUserProfile])
          .select(PROFILE_COLUMNS)
          .single(),
        4500,
        'profile insert',
      );

      if (insertError) throw insertError;
      if (!insertedData) throw new Error('Сервер не вернул созданный профиль.');

      return mapProfileFromDB(insertedData);
    } catch (error) {
      console.error('getOrCreateProfile failed:', error);
      throw error;
    }
  },

  applyGameResult: async (
    userId: string,
    stats: UserStats,
    pet: PetState,
    coinsDelta: number,
    analyticsEvents: QueuedAnalyticsEvent[] = [],
  ): Promise<UserProfile> => {
    const { data, error } = await withTimeout(
      supabase.rpc('apply_game_result', {
        p_user_id: userId,
        p_stats: normalizeStats(stats),
        p_pet: normalizePet(pet),
        p_coins_delta: Math.round(coinsDelta || 0),
        p_analytics_events: analyticsEvents,
      }),
      5000,
      'apply game result',
    );

    if (error) throw error;
    if (!data) throw new Error('Сервер не вернул обновлённый профиль.');
    return mapProfileFromDB(data);
  },

  syncProfileState: async (
    userId: string,
    profile: Pick<UserProfile, 'inventory' | 'pet' | 'coins'>,
    analyticsEvents: QueuedAnalyticsEvent[] = [],
  ): Promise<UserProfile> => {
    const { data, error } = await withTimeout(
      supabase.rpc('sync_profile_state', {
        p_user_id: userId,
        p_inventory: profile.inventory,
        p_pet: normalizePet(profile.pet),
        p_coins: Math.max(0, Math.round(profile.coins || 0)),
        p_analytics_events: analyticsEvents,
      }),
      5000,
      'sync profile state',
    );

    if (error) throw error;
    if (!data) throw new Error('Сервер не вернул обновлённый профиль.');
    return mapProfileFromDB(data);
  },

  updateCoins: async (userId: string, amount: number): Promise<void> => {
    try {
      const { error: rpcError } = await supabase.rpc('increment_coins', { user_id: userId, amount });

      if (rpcError) {
        console.warn('RPC increment_coins failed, falling back to manual update:', rpcError.message);
        const { data: profile, error: fetchErr } = await supabase
          .from('profiles')
          .select('coins')
          .eq('id', userId)
          .single();

        if (fetchErr) throw fetchErr;

        const newCoins = Math.max(0, (profile?.coins ?? 0) + amount);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ coins: newCoins })
          .eq('id', userId);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error in updateCoins:', error);
    }
  },

  buyCurrentUserItem: async (item: ShopItem): Promise<UserProfile | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return userService.buyItem(data.user.id, item);
  },

  buyItem: async (userId: string, item: ShopItem, optimisticProfile?: UserProfile, analyticsEvents: QueuedAnalyticsEvent[] = []): Promise<UserProfile> => {
    if (optimisticProfile) {
      return userService.syncProfileState(userId, optimisticProfile, analyticsEvents);
    }

    if (item.type !== 'mystery') {
      try {
        const { data, error } = await supabase.rpc('purchase_shop_item', {
          p_user_id: userId,
          p_item: toShopItemPayload(item),
        });

        if (!error && data) return mapProfileFromDB(data);
        console.warn('RPC purchase_shop_item failed, falling back to manual update:', error?.message);
      } catch (rpcError) {
        console.warn('RPC purchase_shop_item threw, falling back to manual update:', rpcError);
      }
    }

    try {
      const { data: profile, error: fetchErr } = await withTimeout(
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .single(),
        3500,
        'purchase profile fetch',
      );

      if (fetchErr) throw fetchErr;

      const normalizedProfile = mapProfileFromDB(profile);
      const purchase = applyPurchaseLocally(normalizedProfile, item);
      if (!purchase.ok || !purchase.profile) throw new Error(purchase.reason || 'Покупка не удалась');

      return userService.syncProfileState(userId, purchase.profile, analyticsEvents);
    } catch (error) {
      console.error('Error in buyItem:', error);
      throw error;
    }
  },

  useItem: async (userId: string, itemId: string, optimisticProfile?: UserProfile, analyticsEvents: QueuedAnalyticsEvent[] = []): Promise<UserProfile> => {
    try {
      if (optimisticProfile) {
        return userService.syncProfileState(userId, optimisticProfile, analyticsEvents);
      }

      const { data: profile, error: fetchErr } = await withTimeout(
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .single(),
        8000,
        'use item profile fetch',
      );

      if (fetchErr) throw fetchErr;
      return mapProfileFromDB(profile);
    } catch (error) {
      console.error('Error using item:', error);
      throw error;
    }
  },

  updateUserStats: async (userId: string, newStats: UserStats): Promise<void> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ stats: normalizeStats(newStats) })
        .eq('id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (updateUserStats):', error);
      throw error;
    }
  },

  updateUserDictionary: async (userId: string, dictionary: string[]): Promise<UserProfile> => {
    try {
      const normalizedDictionary = normalizeDictionaryField(dictionary);
      const { data, error } = await supabase
        .from('profiles')
        .update({ custom_dictionary_en: normalizedDictionary, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single();
      if (error) throw error;
      if (!data) throw new Error('Сервер не вернул обновлённый профиль.');
      return mapProfileFromDB(data);
    } catch (error) {
      console.error('Supabase Error (updateUserDictionary):', error);
      throw error;
    }
  },

  updateUserPet: async (userId: string, pet: PetState): Promise<void> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pet: normalizePet(pet) })
        .eq('id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (updateUserPet):', error);
      throw error;
    }
  },

  getAllUsersStats: async (): Promise<UserProfile[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS);
      if (error) throw error;
      return data.map(mapProfileFromDB);
    } catch (error) {
      console.error('Supabase Error (getAllUsersStats):', error);
      throw error;
    }
  }
};