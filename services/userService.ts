import { UserProfile, UserStats, PetState, ShopItem, InventoryItem } from "../types";
import { supabase } from "../supabase";
import { normalizeCustomDictionary } from "./dictionaryEngine";

// --- Helpers ---

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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().toUpperCase().replace(/[^A-Z]/g, ''))
        .filter(Boolean)
    )
  );
};

const normalizeDictionaryField = (value: unknown): string[] =>
  Array.isArray(value) ? normalizeCustomDictionary(value.filter((item): item is string => typeof item === 'string')) : [];

const normalizeStats = (value: unknown): UserStats => {
  if (!isPlainObject(value)) return { ...DEFAULT_STATS };

  const wordsGuessed = isPlainObject(value.wordsGuessed) ? value.wordsGuessed : {};

  return {
    gamesPlayed: typeof value.gamesPlayed === 'number' ? value.gamesPlayed : 0,
    gamesWon: typeof value.gamesWon === 'number' ? value.gamesWon : 0,
    wordsGuessed: Object.fromEntries(
      Object.entries(wordsGuessed).filter((entry): entry is [string, number] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'number'
      )
    )
  };
};

const normalizePet = (value: unknown): PetState => {
  if (!isPlainObject(value)) return { ...DEFAULT_PET };

  return {
    ...DEFAULT_PET,
    ...value,
    name: typeof value.name === 'string' ? value.name : DEFAULT_PET.name,
    type: typeof value.type === 'string' ? value.type : DEFAULT_PET.type,
    level: typeof value.level === 'number' ? value.level : DEFAULT_PET.level,
    mood: ['sad', 'neutral', 'happy', 'excited'].includes(String(value.mood))
      ? value.mood as PetState['mood']
      : DEFAULT_PET.mood,
    xp: typeof value.xp === 'number' ? value.xp : DEFAULT_PET.xp,
    hunger: typeof value.hunger === 'number' ? value.hunger : DEFAULT_PET.hunger,
    energy: typeof value.energy === 'number' ? value.energy : DEFAULT_PET.energy,
    equippedAccessories: normalizeStringArray(value.equippedAccessories)
  };
};

const normalizeInventory = (value: unknown): InventoryItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainObject)
    .map(item => ({
      id: typeof item.id === 'string' ? item.id : '',
      type: ['food', 'pet', 'accessory'].includes(String(item.type))
        ? item.type as InventoryItem['type']
        : 'food',
      name: typeof item.name === 'string' ? item.name : '',
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      metadata: isPlainObject(item.metadata) ? { imageUrl: String(item.metadata.imageUrl || '') } : undefined
    }))
    .filter(item => item.id && item.name && item.quantity > 0);
};

/** Единственный маппер DB-row → UserProfile, используется везде */
const mapProfileFromDB = (data: any): UserProfile => ({
  username: typeof data?.username === 'string' && data.username.trim() ? data.username : 'Guest',
  role: data?.role === 'admin' ? 'admin' : 'user',
  customDictionaryEn: normalizeDictionaryField(data?.custom_dictionary_en),
  stats: normalizeStats(data?.stats),
  pet: normalizePet(data?.pet),
  coins: typeof data?.coins === 'number' ? data.coins : 0,
  inventory: normalizeInventory(data?.inventory)
});

export const userService = {
  /**
   * Получение или создание профиля.
   */
  getOrCreateProfile: async (userId: string, defaultUsername: string = 'Guest', email?: string): Promise<UserProfile> => {
    console.log("userService.getOrCreateProfile started for:", userId);

    // Определяем роль через env-переменную, не хардкодим email в коде
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

    // Connectivity check
    try {
      await fetch(supabase.supabaseUrl, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
        console.error("DIAGNOSTIC: Cannot reach Supabase URL. Likely blocked by AdBlock or Firewall.");
      });
    } catch (_) {
      // Ignore ping errors
    }

    try {
      let profileData = null;
      let fetchError: any = null;

      // Attempt 1: 4s, Attempt 2: 8s
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

          if (error && error.code !== 'PGRST116') {
            break;
          }
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

  /**
   * Обновление монет (атомарно через RPC).
   */
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

  /**
   * Покупка предмета.
   */
  buyItem: async (userId: string, item: ShopItem): Promise<UserProfile> => {
    console.log(`userService.buyItem: userId=${userId}, item=${item.id}`);
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

      if (updateError) {
        if (updateError.message.includes("schema cache")) {
          console.error("HINT: Run 'NOTIFY pgrst, \'reload schema\';' in Supabase SQL editor.");
        }
        throw updateError;
      }

      return mapProfileFromDB(updatedProfile);
    } catch (error) {
      console.error("Error in buyItem:", error);
      throw error;
    }
  },

  /**
   * Использование предмета.
   */
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
        if (item.quantity <= 0) {
          inventory.splice(itemIndex, 1);
        }
      } else if (item.type === 'pet') {
        pet.type = item.name;
        pet.name = item.name;
      } else if (item.type === 'accessory') {
        if (!pet.equippedAccessories) pet.equippedAccessories = [];
        const accIndex = pet.equippedAccessories.indexOf(item.id);
        if (accIndex > -1) {
          pet.equippedAccessories.splice(accIndex, 1);
        } else {
          pet.equippedAccessories.push(item.id);
        }
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

  /**
   * Обновление статистики.
   */
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

  /**
   * Обновление словаря пользователя.
   */
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

  /**
   * Обновление состояния питомца.
   */
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

  /**
   * Получение статистики всех пользователей (только для админа).
   */
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
