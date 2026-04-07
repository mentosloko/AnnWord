import { UserProfile, UserStats, PetState, ShopItem } from "../types";
import { supabase } from "../supabase";

const SIMULATED_NETWORK_DELAY = 500;
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const userService = {
  /**
   * Получение или создание профиля.
   */
  getOrCreateProfile: async (userId: string, defaultUsername: string = 'Guest', email?: string): Promise<UserProfile> => {
    console.log("userService.getOrCreateProfile started for:", userId);
    
    const createDefault = (role: 'admin' | 'user'): UserProfile => ({
      username: defaultUsername,
      role: role,
      customDictionaryEn: [],
      stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
      pet: { 
        name: 'Owl', 
        type: 'Owl',
        level: 1, 
        mood: 'happy', 
        xp: 0,
        hunger: 100,
        energy: 100,
        equippedAccessories: []
      },
      coins: 100,
      inventory: []
    });

    const role: 'admin' | 'user' = (email === 'mentosloko@gmail.com') ? 'admin' : 'user';

    // Connectivity check
    try {
      const ping = await fetch(supabase.supabaseUrl, { method: 'HEAD', mode: 'no-cors' }).catch(() => null);
      if (!ping) {
        console.error("DIAGNOSTIC: Cannot reach Supabase URL. Likely blocked by browser extension (AdBlock) or Firewall.");
      }
    } catch (e) {
      // Ignore ping errors
    }

    try {
      let profileData = null;
      
      // Attempt 1: Fast check (4s)
      // Attempt 2: Longer check (8s)
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
          console.warn(`Attempt ${i + 1} timed out or was blocked by browser extension:`, e.message);
          if (i === 1) throw e; // На последней попытке пробрасываем ошибку дальше
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!profileData) {
        console.log("Profile not found or blocked, attempting manual insert...");
        const newUserProfile = {
          id: userId,
          username: defaultUsername,
          role: role,
          custom_dictionary_en: [],
          stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
          pet: { 
            name: 'Owl', 
            type: 'Owl',
            level: 1, 
            mood: 'happy', 
            xp: 0,
            hunger: 100,
            energy: 100,
            equippedAccessories: []
          },
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
            console.warn("Manual insert failed (likely RLS):", insertError.message);
            return createDefault(role);
          }
          profileData = insertedData;
        } catch (e) {
          console.error("Insert timed out or blocked, using default profile");
          return createDefault(role);
        }
      }

      return {
        username: profileData.username,
        role: profileData.role,
        customDictionaryEn: profileData.custom_dictionary_en || [],
        stats: profileData.stats || { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
        pet: profileData.pet || { 
          name: 'Owl', 
          type: 'Owl',
          level: 1, 
          mood: 'happy', 
          xp: 0,
          hunger: 100,
          energy: 100,
          equippedAccessories: []
        },
        coins: profileData.coins ?? 0,
        inventory: profileData.inventory || []
      } as UserProfile;
    } catch (error) {
      console.error("getOrCreateProfile failed, falling back to default:", error);
      return createDefault(role);
    }
  },

  /**
   * Обновление монет.
   */
  updateCoins: async (userId: string, amount: number): Promise<void> => {
    console.log(`userService.updateCoins: userId=${userId}, amount=${amount}`);
    try {
      // Try RPC first
      const { error: rpcError } = await supabase.rpc('increment_coins', { user_id: userId, amount: amount });
      
      if (rpcError) {
        console.warn("RPC increment_coins failed, falling back to manual update:", rpcError.message);
        // Fallback to manual update
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('coins')
          .eq('id', userId)
          .single();
          
        if (fetchError) {
          console.error("Manual fetch for coins failed:", fetchError.message);
          throw fetchError;
        }

        const currentCoins = profile?.coins ?? 0;
        const newCoins = currentCoins + amount;
        
        console.log(`Manual update: current=${currentCoins}, new=${newCoins}`);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ coins: newCoins })
          .eq('id', userId);
          
        if (updateError) {
          console.error("Manual update for coins failed:", updateError.message);
          throw updateError;
        }
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
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error("Fetch profile for buyItem failed:", fetchError.message);
        throw fetchError;
      }

      if (profile.coins < item.price) {
        throw new Error("Недостаточно монет");
      }

      const newCoins = profile.coins - item.price;
      const inventory = [...(profile.inventory || [])];
      
      // Проверяем, есть ли уже такой предмет (для еды увеличиваем количество)
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

      console.log(`Updating profile after purchase: newCoins=${newCoins}, inventorySize=${inventory.length}`);

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ 
          coins: newCoins, 
          inventory: inventory 
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error("Update profile after purchase failed:", updateError.message);
        if (updateError.message.includes("schema cache")) {
          console.error("HINT: Try running 'NOTIFY pgrst, 'reload schema';' in your Supabase SQL editor.");
        }
        throw updateError;
      }

      return {
        username: updatedProfile.username,
        role: updatedProfile.role,
        customDictionaryEn: updatedProfile.custom_dictionary_en,
        stats: updatedProfile.stats,
        pet: updatedProfile.pet,
        coins: updatedProfile.coins,
        inventory: updatedProfile.inventory
      } as UserProfile;
    } catch (error) {
      console.error("Error in buyItem:", error);
      throw error;
    }
  },

  /**
   * Использование предмета (кормление или смена питомца/аксессуара).
   */
  useItem: async (userId: string, itemId: string): Promise<UserProfile> => {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const inventory = [...(profile.inventory || [])];
      const itemIndex = inventory.findIndex((i: any) => i.id === itemId);
      if (itemIndex === -1) throw new Error("Предмет не найден");

      const item = inventory[itemIndex];
      const pet = { ...profile.pet };

      if (item.type === 'food') {
        pet.hunger = Math.min(100, (pet.hunger || 0) + 20);
        pet.mood = 'happy';
        item.quantity -= 1;
        if (item.quantity <= 0) {
          inventory.splice(itemIndex, 1);
        }
      } else if (item.type === 'pet') {
        pet.type = item.name;
        pet.name = item.name; // Можно дать возможность переименовать
      } else if (item.type === 'accessory') {
        if (!pet.equippedAccessories) pet.equippedAccessories = [];
        const accIndex = pet.equippedAccessories.indexOf(item.id);
        if (accIndex > -1) {
          pet.equippedAccessories.splice(accIndex, 1); // Снять
        } else {
          pet.equippedAccessories.push(item.id); // Надеть
        }
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ inventory: inventory, pet: pet })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      return {
        username: updatedProfile.username,
        role: updatedProfile.role,
        customDictionaryEn: updatedProfile.custom_dictionary_en,
        stats: updatedProfile.stats,
        pet: updatedProfile.pet,
        coins: updatedProfile.coins,
        inventory: updatedProfile.inventory
      } as UserProfile;
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
        .update({ stats: newStats })
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
        .update({ custom_dictionary_en: dictionary })
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
        .update({ pet: pet })
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

      return data.map(item => ({
        username: item.username,
        role: item.role,
        customDictionaryEn: item.custom_dictionary_en || [],
        stats: item.stats || { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
        pet: item.pet || { name: 'Owl', level: 1, mood: 'happy', xp: 0 },
      })) as UserProfile[];
    } catch (error) {
      console.error("Supabase Error (getAllUsersStats):", error);
      throw error;
    }
  }
};
