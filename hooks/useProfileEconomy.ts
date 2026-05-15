import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { PetState, ShopItem, UserProfile, UserStats } from '../types';

interface UseProfileEconomyArgs {
  currentUserId: string | null;
  userProfile: UserProfile;
  setUserProfile: Dispatch<SetStateAction<UserProfile>>;
}

const getUserService = async () => {
  const module = await import('../services/userService');
  return module.userService;
};

export const useProfileEconomy = ({ currentUserId, userProfile, setUserProfile }: UseProfileEconomyArgs) => {
  const winCoins = useCallback(async (amount: number) => {
    setUserProfile(prev => ({ ...prev, coins: prev.coins + amount }));
    if (!currentUserId) return;
    try {
      const userService = await getUserService();
      await userService.updateCoins(currentUserId, amount);
    } catch (error) {
      console.error('Failed to sync coins to server', error);
    }
  }, [currentUserId, setUserProfile]);

  const buyItem = useCallback(async (item: ShopItem) => {
    if (!currentUserId) return;
    const userService = await getUserService();
    const updatedProfile = await userService.buyItem(currentUserId, item);
    setUserProfile(updatedProfile);
  }, [currentUserId, setUserProfile]);

  const useItem = useCallback(async (itemId: string) => {
    if (!currentUserId) return;
    const userService = await getUserService();
    const updatedProfile = await userService.useItem(currentUserId, itemId);
    setUserProfile(updatedProfile);
  }, [currentUserId, setUserProfile]);

  const addXP = useCallback(async (amount: number) => {
    const newPet: PetState = { ...userProfile.pet, xp: userProfile.pet.xp + amount };
    if (newPet.xp >= newPet.level * 100) {
      newPet.xp -= newPet.level * 100;
      newPet.level += 1;
      newPet.mood = 'excited';
    } else {
      newPet.mood = 'happy';
    }

    setUserProfile(prev => ({ ...prev, pet: newPet }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      await userService.updateUserPet(currentUserId, newPet);
    } catch (error) {
      console.error('Failed to update pet', error);
    }
  }, [currentUserId, setUserProfile, userProfile.pet]);

  const updateStats = useCallback(async (stats: UserStats) => {
    setUserProfile(prev => ({ ...prev, stats }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      await userService.updateStats(currentUserId, stats);
    } catch (error) {
      console.error('Failed to update stats', error);
    }
  }, [currentUserId, setUserProfile]);

  const updateDictionary = useCallback(async (dictionary: string[]) => {
    setUserProfile(prev => ({ ...prev, customDictionaryEn: dictionary }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      await userService.updateCustomDictionary(currentUserId, dictionary);
    } catch (error) {
      console.error('Failed to update custom dictionary', error);
    }
  }, [currentUserId, setUserProfile]);

  return {
    winCoins,
    buyItem,
    useItem,
    addXP,
    updateStats,
    updateDictionary,
  };
};
