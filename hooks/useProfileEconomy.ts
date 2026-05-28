import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { PetState, ShopItem, UserProfile, UserStats } from '../types';
import { analyticsService } from '../services/analyticsService';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { applyItemUseLocally, applyPurchaseLocally } from '../services/economyEngine';

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
    setUserProfile(prev => ({ ...prev, coins: Math.max(0, prev.coins + amount) }));
    if (!currentUserId) return;
    try {
      const userService = await getUserService();
      await userService.updateCoins(currentUserId, amount);
    } catch (error) {
      console.error('Failed to sync coins to server', error);
    }
  }, [currentUserId, setUserProfile]);

  const buyItem = useCallback(async (item: ShopItem) => {
    const localPurchase = applyPurchaseLocally(userProfile, item);
    if (!localPurchase.ok || !localPurchase.profile) {
      throw new Error(localPurchase.reason || 'Покупка не удалась');
    }

    setUserProfile(localPurchase.profile);

    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'economy',
      eventName: 'shop_item_bought',
      route: 'shop',
      payload: {
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        price: item.price,
        coinsBefore: userProfile.coins,
        coinsAfter: localPurchase.profile.coins,
        inventoryBefore: userProfile.inventory.length,
        inventoryAfter: localPurchase.profile.inventory.length,
      },
    });

    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      const updatedProfile = await userService.buyItem(currentUserId, item);
      setUserProfile(updatedProfile);
    } catch (error) {
      setUserProfile(userProfile);
      throw error;
    }
  }, [currentUserId, setUserProfile, userProfile]);

  const useItem = useCallback(async (itemId: string) => {
    const localUse = applyItemUseLocally(userProfile, itemId);
    if (!localUse.ok || !localUse.profile) {
      throw new Error(localUse.reason || 'Предмет не найден');
    }

    setUserProfile(localUse.profile);

    const usedItem = userProfile.inventory.find(item => item.id === itemId);
    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'inventory',
      eventName: 'inventory_item_used',
      route: 'pet_room',
      payload: {
        itemId,
        itemName: usedItem?.name || itemId,
        itemType: usedItem?.type || null,
        quantityBefore: usedItem?.quantity || 0,
        petType: userProfile.pet.type,
        moodBefore: userProfile.pet.moodScore ?? null,
        moodAfter: localUse.profile.pet.moodScore ?? null,
        levelBefore: userProfile.pet.level,
        levelAfter: localUse.profile.pet.level,
      },
    });

    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      const updatedProfile = await userService.useItem(currentUserId, itemId, localUse.profile);
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Failed to sync item usage to server; optimistic local state kept', error);
    }
  }, [currentUserId, setUserProfile, userProfile]);

  const updateCharacter = useCallback(async (pet: PetState) => {
    setUserProfile(prev => ({ ...prev, pet }));
    if (!currentUserId) return;
    try {
      const userService = await getUserService();
      await userService.updateUserPet(currentUserId, pet);
    } catch (error) {
      console.error('Failed to update character', error);
    }
  }, [currentUserId, setUserProfile]);

  const addXP = useCallback(async (amount: number) => {
    const progress = applyGameRewardToCharacter(userProfile.pet, { xp: amount, mood: amount });
    await updateCharacter(progress.pet);
  }, [updateCharacter, userProfile.pet]);

  const applyGameReward = useCallback(async (input: GameRewardInput) => {
    const reward = calculateGameReward(input);
    const progress = applyGameRewardToCharacter(userProfile.pet, reward);
    const nextPet: PetState = progress.pet;

    const nextProfile: UserProfile = {
      ...userProfile,
      coins: Math.max(0, userProfile.coins + reward.coins),
      pet: nextPet,
    };

    setUserProfile(nextProfile);

    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'reward',
      eventName: 'reward_granted',
      gameType: input.type,
      payload: {
        input,
        label: reward.label,
        xp: reward.xp,
        coins: reward.coins,
        mood: reward.mood,
        coinsBefore: userProfile.coins,
        coinsAfter: nextProfile.coins,
        previousLevel: progress.previousLevel,
        newLevel: progress.newLevel,
        previousStage: progress.previousStage,
        newStage: progress.newStage,
        leveledUp: progress.leveledUp,
        stagedUp: progress.stagedUp,
      },
    });

    if (currentUserId) {
      try {
        const userService = await getUserService();
        if (reward.coins !== 0) await userService.updateCoins(currentUserId, reward.coins);
        if (reward.xp !== 0 || reward.mood !== 0) await userService.updateUserPet(currentUserId, nextPet);
      } catch (error) {
        console.error('Failed to sync game reward', error);
      }
    }

    return { reward, progress };
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
    if (!currentUserId) {
      throw new Error('Для сохранения своего словаря нужно войти в аккаунт.');
    }

    const userService = await getUserService();
    const updatedProfile = await userService.updateUserDictionary(currentUserId, dictionary);
    setUserProfile(updatedProfile);

    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'dictionary',
      eventName: 'dictionary_uploaded',
      route: 'setup',
      payload: {
        wordsCount: dictionary.length,
      },
    });
  }, [currentUserId, setUserProfile]);

  return {
    winCoins,
    buyItem,
    useItem,
    updateCharacter,
    addXP,
    applyGameReward,
    updateStats,
    updateDictionary,
  };
};