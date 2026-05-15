import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { GameRewardInput, PetState, ShopItem, UserProfile, UserStats } from '../types';
import { applyGameRewardToCharacter, calculateGameReward } from '../services/gamificationRules';

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
    const progress = applyGameRewardToCharacter(userProfile.pet, { xp: amount, mood: amount });
    const newPet: PetState = progress.pet;

    setUserProfile(prev => ({ ...prev, pet: newPet }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      await userService.updateUserPet(currentUserId, newPet);
    } catch (error) {
      console.error('Failed to update pet', error);
    }
  }, [currentUserId, setUserProfile, userProfile.pet]);

  const applyGameReward = useCallback(async (input: GameRewardInput) => {
    const reward = calculateGameReward(input);
    let nextPet: PetState = userProfile.pet;
    if (reward.xp > 0 || reward.mood > 0) {
      nextPet = applyGameRewardToCharacter(userProfile.pet, reward).pet;
    }

    const nextProfile: UserProfile = {
      ...userProfile,
      coins: userProfile.coins + reward.coins,
      pet: nextPet,
    };

    setUserProfile(nextProfile);

    if (currentUserId) {
      try {
        const userService = await getUserService();
        if (reward.coins !== 0) await userService.updateCoins(currentUserId, reward.coins);
        if (nextPet !== userProfile.pet) await userService.updateUserPet(currentUserId, nextPet);
      } catch (error) {
        console.error('Failed to sync game reward', error);
      }
    }

    return {
      reward,
      progress: applyGameRewardToCharacter(userProfile.pet, reward),
    };
  }, [currentUserId, setUserProfile, userProfile]);

  const updateStats = useCallback(async (stats: UserStats) => {
    setUserProfile(prev => ({ ...prev, stats }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      await userService.updateUserStats(currentUserId, stats);
    } catch (error) {
      console.error('Failed to update stats', error);
    }
  }, [currentUserId, setUserProfile]);

  const updateDictionary = useCallback(async (dictionary: string[]) => {
    setUserProfile(prev => ({ ...prev, customDictionaryEn: dictionary }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      await userService.updateUserDictionary(currentUserId, dictionary);
    } catch (error) {
      console.error('Failed to update custom dictionary', error);
    }
  }, [currentUserId, setUserProfile]);

  return {
    winCoins,
    buyItem,
    useItem,
    addXP,
    applyGameReward,
    updateStats,
    updateDictionary,
  };
};