import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { PetState, ShopItem, UserProfile, UserStats } from '../types';
import { analyticsService, QueuedAnalyticsEvent } from '../services/analyticsService';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { applyItemUseLocally, applyPurchaseLocally } from '../services/economyEngine';
import { gameEventLedgerService } from '../services/gameEventLedgerService';

interface UseProfileEconomyArgs {
  currentUserId: string | null;
  userProfile: UserProfile;
  setUserProfile: Dispatch<SetStateAction<UserProfile>>;
}

interface ApplyGameRewardOptions {
  stats?: UserStats;
  analyticsEvents?: QueuedAnalyticsEvent[];
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
      const updatedProfile = await userService.updateCoins(currentUserId, amount);
      if (updatedProfile) setUserProfile(updatedProfile);
    } catch (error) {
      setUserProfile(userProfile);
      console.error('Failed to sync coins to server', error);
    }
  }, [currentUserId, setUserProfile, userProfile]);

  const buyItem = useCallback(async (item: ShopItem) => {
    const localPurchase = applyPurchaseLocally(userProfile, item);
    if (!localPurchase.ok || !localPurchase.profile) {
      throw new Error(localPurchase.reason || 'Покупка не удалась');
    }

    const purchaseEvent = analyticsService.createEvent({
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
        awardedItemId: localPurchase.awardedItem?.id || null,
        awardedItemName: localPurchase.awardedItem?.name || null,
      },
    });

    setUserProfile(localPurchase.profile);

    if (!currentUserId) {
      analyticsService.trackEvent({
        userId: null,
        eventType: 'economy',
        eventName: 'shop_item_bought',
        route: 'shop',
        payload: purchaseEvent.payload,
      });
      return;
    }

    try {
      const userService = await getUserService();
      const updatedProfile = await userService.buyItem(currentUserId, item, localPurchase.profile, [purchaseEvent]);
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

    const usedItem = userProfile.inventory.find(item => item.id === itemId);
    const useEvent = analyticsService.createEvent({
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

    setUserProfile(localUse.profile);

    if (!currentUserId) {
      analyticsService.trackEvent({
        userId: null,
        eventType: 'inventory',
        eventName: 'inventory_item_used',
        route: 'pet_room',
        payload: useEvent.payload,
      });
      return;
    }

    try {
      const userService = await getUserService();
      const updatedProfile = await userService.useItem(currentUserId, itemId, localUse.profile, [useEvent]);
      setUserProfile(updatedProfile);
    } catch (error) {
      setUserProfile(userProfile);
      console.error('Failed to sync item usage to server', error);
    }
  }, [currentUserId, setUserProfile, userProfile]);

  const updateCharacter = useCallback(async (pet: PetState) => {
    setUserProfile(prev => ({ ...prev, pet }));
    if (!currentUserId) return;
    try {
      const userService = await getUserService();
      const updatedProfile = await userService.updateUserPet(currentUserId, pet);
      if (updatedProfile) setUserProfile(updatedProfile);
    } catch (error) {
      setUserProfile(userProfile);
      console.error('Failed to update character', error);
      throw error;
    }
  }, [currentUserId, setUserProfile, userProfile]);

  const addXP = useCallback(async (amount: number) => {
    const progress = applyGameRewardToCharacter(userProfile.pet, { xp: amount, coins: 0, mood: 0, label: 'XP adjustment' });
    await updateCharacter(progress.pet);
  }, [updateCharacter, userProfile.pet]);

  const applyGameReward = useCallback(async (input: GameRewardInput, options: ApplyGameRewardOptions = {}) => {
    const reward = calculateGameReward(input);
    const progress = applyGameRewardToCharacter(userProfile.pet, reward);
    const nextPet: PetState = progress.pet;
    const nextStats = options.stats || userProfile.stats;

    const nextProfile: UserProfile = {
      ...userProfile,
      stats: nextStats,
      coins: Math.max(0, userProfile.coins + reward.coins),
      pet: nextPet,
    };

    const rewardEvent = analyticsService.createEvent({
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

    setUserProfile(nextProfile);

    if (currentUserId) {
      try {
        const userService = await getUserService();
        const analyticsEvents = [...(options.analyticsEvents || []), rewardEvent];
        const ledgerEvents = gameEventLedgerService.createRewardEvents(currentUserId, input, analyticsEvents, reward);
        const updatedProfile = await userService.applyGameResult(
          currentUserId,
          nextStats,
          nextPet,
          reward.coins,
          analyticsEvents,
          ledgerEvents,
        );
        setUserProfile(updatedProfile);
      } catch (error) {
        setUserProfile(userProfile);
        console.error('Failed to sync game reward', error);
        throw error;
      }
    } else {
      for (const event of options.analyticsEvents || []) {
        analyticsService.trackEvent({
          userId: null,
          eventType: event.event_type,
          eventName: event.event_name,
          gameType: event.game_type,
          route: event.route,
          payload: event.payload,
        });
      }
      analyticsService.trackEvent({
        userId: null,
        eventType: 'reward',
        eventName: 'reward_granted',
        gameType: input.type,
        payload: rewardEvent.payload,
      });
    }

    return { reward, progress };
  }, [currentUserId, setUserProfile, userProfile]);

  const updateStats = useCallback(async (stats: UserStats) => {
    setUserProfile(prev => ({ ...prev, stats }));
    if (!currentUserId) return;

    try {
      const userService = await getUserService();
      const updatedProfile = await userService.updateUserStats(currentUserId, stats);
      if (updatedProfile) setUserProfile(updatedProfile);
    } catch (error) {
      setUserProfile(userProfile);
      console.error('Failed to update stats', error);
      throw error;
    }
  }, [currentUserId, setUserProfile, userProfile]);

  const updateDictionary = useCallback(async (dictionary: string[]) => {
    if (!currentUserId) {
      throw new Error('Для сохранения своего словаря нужно войти в аккаунт.');
    }

    const userService = await getUserService();
    const updatedProfile = await userService.updateUserDictionary(currentUserId, dictionary);
    setUserProfile(updatedProfile);

    analyticsService.trackEvent({
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