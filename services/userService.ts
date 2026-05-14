import { UserProfile, UserStats, PetState, ShopItem } from "../types";
import { supabase } from "../supabase";
import { mapProfileFromDB, normalizeDictionaryField, normalizePet, normalizeStats } from "./profileMapper";

const DEFAULT_PET: PetState = {
  name: 'Owl',
  type: 'Owl',
  level: 1,
  mood: 'happy',
  xp: 0,
  hunger: 100,
  energy: 100,
  equippedAccessories: []
};

const DEFAULT_STATS: UserStats = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} };

const toShopItemPayload = (item: ShopItem) => ({
  id: item.id,
  type: item.type,
  name: item.name,
  price: item.price,
  imageUrl: item.imageUrl || '',
});

export const userService = {
  getOrCreateProfile: async (userId: string, defaultUsername: string = 'Guest', email?: string): Promise<UserProfile> => {
    console.log("userService.getOrCreateProfile started for:", userId);

    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const role: 'admin' | 'user' = adminEmails.includes(email ?? '') ? 'admin' : 'user';

    const createDefault = (): UserProfile => ({
      username: defaultUsername,
      role,
      customDictionaryEn: [],
      stats: { ...DEFAULT_STATS },
      pet: { ...DEFAULT_PET },
      coins: 100,
      inventory: []
    });

    try {
      await fetch(supabase.supabaseUrl, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
        console.error("DIAGNOSTIC: Cannot reach Supabase URL. Likely blocked by AdBlock or Firewall.");
      });
    } catch (_) {}

    try {
      let profileData = null;
      let fetchError: any = null;

      for (let i = 0; i < 2; i++) {
        const timeoutMs = i === 0 ? 4000 : 8000;
        console.log(`Fetch attempt ${i + 1} (Timeout: ${timeoutMs}ms)...`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request Timeout")), timeoutMs)
        );

        const fetchPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        try {
          const result: any = await Promise.race([fetchPromise, timeoutPromise]);
          const { data, error } = result;

          if (data) {
            console.log("Profile found on attempt", i + 1);
            profileData = data;
            break;
          }

          fetchError = error;
          console.log(`Attempt ${i + 1} failed with error code:`, error?.code);

          if (error && error.code !== 'PGRST116') break;
        } catch (e: any) {
          console.warn(`Attempt ${i + 1} timed out or was blocked:`, e.message);
          if (i === 1) throw e;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!profileData) {
        console.log("Profile not found, attempting insert...", fetchError?.message || 'no existing row');
        const newUserProfile = {
          id: userId,
          username: defaultUsername,
          role,
          custom_dictionary_en: [],
          stats: DEFAULT_STATS,
          pet: { ...DEFAULT_PET },
          coins: 100,
          inventory: []
        };

        const insertPromise = supabase
          .from('profiles')
          .insert([newUserProfile])
          .select()
          .single();

        const insertTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Insert Timeout")), 7000)
        );

        try {
          const insertResult: any = await Promise.race([insertPromise, insertTimeout]);
          const { data: insertedData, error: insertError } = insertResult;

          if (insertError) {
            console.warn("Insert failed (likely RLS):", insertError.message);
            return createDefault();
          }
          profileData = insertedData;
        } catch (e) {
          console.error("Insert timed out or blocked, using default profile");
          return createDefault();
        }
      }

      return mapProfileFromDB(profileData);
    } catch (error) {
      console.error("getOrCreateProfile failed, falling back to default:", error);
      return createDefault();
    }
  },

  updateCoins: async (userId: string, amount: number): Promise<void> => {
    console.log(`userService.updateCoins: userId=${userId}, amount=${amount}`);
    try {
      const { error: rpcError } = await supabase.rpc('increment_coins', { user_id: userId, amount });

      if (rpcError) {
        console.warn("RPC increment_coins failed, falling back to manual update:", rpcError.message);
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
      console.error("Error in updateCoins:", error);
    }
  },

  buyCurrentUserItem: async (item: ShopItem): Promise<UserProfile | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return userService.buyItem(data.user.id, item);
  },

  buyItem: async (userId: string, item: ShopItem): Promise<UserProfile> => {
    console.log(`userService.buyItem: userId=${userId}, item=${item.id}`);

    try {
      const { data, error } = await supabase.rpc('purchase_shop_item', {
        p_user_id: userId,
        p_item: toShopItemPayload(item),
      });

      if (!error && data) {
        return mapProfileFromDB(data);
      }

      console.warn("RPC purchase_shop_item failed, falling back to manual update:", error?.message);
    } catch (rpcError) {
      console.warn("RPC purchase_shop_item threw, falling back to manual update:", rpcError);
    }

    try {
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchErr) throw fetchErr;

      const normalizedProfile = mapProfileFromDB(profile);

      if (normalizedProfile.coins < item.price) {
        throw new Error("Недостаточно монет");
      }

      const newCoins = normalizedProfile.coins - item.price;
      const inventory = [...normalizedProfile.inventory];

      const existingItemIndex = inventory.findIndex((i: any) => i.id === item.id);
      if (existingItemIndex > -1 && item.type === 'food') {
        inventory[existingItemIndex].quantity += 1;
      } else {
        inventory.push({
          id: item.id,
          type: item.type,
          name: item.name,
          quantity: 1,
          metadata: { imageUrl: item.imageUrl }
        });
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ coins: newCoins, inventory })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      return mapProfileFromDB(updatedProfile);
    } catch (error) {
      console.error("Error in buyItem:", error);
      throw error;
    }
  },

  useItem: async (userId: string, itemId: string): Promise<UserProfile> => {
    try {
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchErr) throw fetchErr;

      const normalizedProfile = mapProfileFromDB(profile);
      const inventory = [...normalizedProfile.inventory];
      const itemIndex = inventory.findIndex((i: any) => i.id === itemId);
      if (itemIndex === -1) throw new Error("Предмет не найден");

      const item = inventory[itemIndex];
      const pet = { ...normalizedProfile.pet };

      if (item.type === 'food') {
        pet.hunger = Math.min(100, (pet.hunger || 0) + 20);
        pet.mood = 'happy';
        item.quantity -= 1;
        if (item.quantity <= 0) inventory.splice(itemIndex, 1);
      } else if (item.type === 'pet') {
        pet.type = item.name;
        pet.name = item.name;
      } else if (item.type === 'accessory') {
        if (!pet.equippedAccessories) pet.equippedAccessories = [];
        const accIndex = pet.equippedAccessories.indexOf(item.id);
        if (accIndex > -1) pet.equippedAccessories.splice(accIndex, 1);
        else pet.equippedAccessories.push(item.id);
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ inventory, pet })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      return mapProfileFromDB(updatedProfile);
    } catch (error) {
      console.error("Error using item:", error);
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
      console.error("Supabase Error (updateUserStats):", error);
      throw error;
    }
  },

  updateUserDictionary: async (userId: string, dictionary: string[]): Promise<void> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ custom_dictionary_en: normalizeDictionaryField(dictionary) })
        .eq('id', userId);
      if (error) throw error;
    } catch (error) {
      console.error("Supabase Error (updateUserDictionary):", error);
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
      console.error("Supabase Error (updateUserPet):", error);
      throw error;
    }
  },

  getAllUsersStats: async (): Promise<UserProfile[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      if (error) throw error;
      return data.map(mapProfileFromDB);
    } catch (error) {
      console.error("Supabase Error (getAllUsersStats):", error);
      throw error;
    }
  }
};
