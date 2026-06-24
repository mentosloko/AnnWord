import { supabase } from '../supabase';
import { DailyQuestCompletionReward, DailyQuestState, PetWorldId, UserProfile } from '../types';
import { GameRewardInput } from './gamificationRules';
import { mapProfileFromDB } from './profileMapper';
import { getShopItemById } from './shopCatalog';
import { normalizeDailyQuest } from './dailyQuest';
import { backendApiRequest, isBackendApiConfigured } from './backendApiClient';

interface DailyQuestGameResult {
  quest: DailyQuestState;
  reward: DailyQuestCompletionReward | null;
  profile: UserProfile | null;
}

const WORLD_IDS: PetWorldId[] = ['theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge'];
const normalizeWorldId = (value: unknown): PetWorldId | null =>
  WORLD_IDS.includes(value as PetWorldId) ? value as PetWorldId : null;

export const dailyQuestService = {
  getTodayQuest: async (): Promise<DailyQuestState | null> => {
    if (isBackendApiConfigured) {
      const data = await backendApiRequest<{ quest: DailyQuestState }>('/api/daily-quest/today');
      return normalizeDailyQuest(data.quest);
    }

    const { data, error } = await supabase.rpc('get_daily_quest');
    if (error) throw error;
    return normalizeDailyQuest(data);
  },

  submitGameResult: async (input: GameRewardInput): Promise<DailyQuestGameResult> => {
    if (isBackendApiConfigured) {
      const data = await backendApiRequest<DailyQuestGameResult>('/api/daily-quest/result', {
        method: 'POST',
        body: input,
      });
      const quest = normalizeDailyQuest(data.quest);
      if (!quest) throw new Error('Не удалось получить ежедневное задание.');
      return { ...data, quest };
    }

    const { data, error } = await supabase.rpc('apply_daily_quest_result', {
      p_game_type: input.type,
      p_result: input,
    });
    if (error) throw error;
    const quest = normalizeDailyQuest(data?.quest);
    if (!quest) throw new Error('Не удалось получить ежедневное задание.');
    const item = data?.new_reward_item_id ? getShopItemById(data.new_reward_item_id) : undefined;
    const worldId = normalizeWorldId(data?.new_reward_world_id);
    return {
      quest,
      reward: item || worldId ? { quest, item: item || null, worldId } : null,
      profile: data?.profile ? mapProfileFromDB(data.profile) : null,
    };
  },
};