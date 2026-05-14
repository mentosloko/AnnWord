import { useCallback } from 'react';
import { PetState, ShopItem, UserProfile, UserStats } from '../types';
import { userService } from '../services/userService';

interface UseProfileEconomyArgs {
  currentUserId: string | null;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

export const useProfileEconomy = ({ currentUserId, userProfile, setUserProfile }: UseProfileEconomyArgs) => {
  const winCoins = useCallback(async (amount: number) => {
    setUserProfile(prev => ({ ...prev, coins: prev.coins + amount }));
    if (!currentUserId) return;
    try {
      await userService.updateCoins(currentUserId, amount);
    } catch (error) {
      console.error('Failed to sync coins to server', error);
    }
  }, [currentUserId, setUserProfile]);

  const buyItem = useCallback(async (item: ShopItem) => {
    if (!currentUserId) return;
    const updatedProfile = await userService.buyItem(currentUserId, item);
    setUserProfile(updatedProfile);
  }, [currentUserId, setUserProfile]);

  const useItem = useCallback(async (itemId: string) => {
    if (!currentUserId) return;
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
      await userService.updateUserPet(currentUserId, newPet);
    } catch (error) {
      console.error('Failed to update pet', error);
    }
  }, [currentUserId, setUserProfile, userProfile.pet]);

  const updateStats = useCallback(async (newStats: UserStats) => {
    setUserProfile(prev => ({ ...prev, stats: newStats }));
    if (!currentUserId) return;

    try {
      await userService.updateUserStats(currentUserId, newStats);
    } catch (error) {
      console.error('Failed to sync stats to server', error);
    }
  }, [currentUserId, setUserProfile]);

  const updateDictionary = useCallback(async (dictionary: string[]) => {
    setUserProfile(prev => ({ ...prev, customDictionaryEn: dictionary }));
    if (!currentUserId) return;

    try {
      await userService.updateUserDictionary(currentUserId, dictionary);
    } catch (error) {
      console.error('Failed to upload dictionary', error);
      throw error;
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
