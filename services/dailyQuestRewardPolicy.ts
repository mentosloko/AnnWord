import type { PetWorldId, ShopItem } from '../types';
import { pickDailyQuestTreat } from './dailyQuestRewardCatalog';

export interface DailyQuestRewardChoice {
  item: ShopItem | null;
  worldId: PetWorldId | null;
}

const DAILY_WORLD_IDS: PetWorldId[] = ['theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge'];
const WORLD_REWARD_WEIGHT = 7;
const TOTAL_REWARD_WEIGHT = 10;

const stableIndex = (input: string, modulo: number): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
};

/**
 * Daily Kids rewards are deterministic for a user and date so retries cannot
 * change the awarded result. Backgrounds occupy 70% of the distribution;
 * treats occupy the remaining 30%.
 */
export const pickDailyQuestRewardChoice = (userId: string, questDate: string): DailyQuestRewardChoice => {
  const rewardPoint = stableIndex(`${userId}:${questDate}:daily-reward-v2`, TOTAL_REWARD_WEIGHT);
  if (rewardPoint < WORLD_REWARD_WEIGHT) {
    const worldId = DAILY_WORLD_IDS[stableIndex(`${userId}:${questDate}:daily-world-v2`, DAILY_WORLD_IDS.length)];
    return { item: null, worldId };
  }
  return { item: pickDailyQuestTreat(userId, questDate), worldId: null };
};
