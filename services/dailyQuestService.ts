import { supabase } from '../supabase';
import { DailyQuestCompletionReward, DailyQuestState, GameRewardInput, UserProfile } from '../types';
import { mapProfileFromDB } from './profileMapper';
import { getShopItemById } from './shopCatalog';
import { normalizeDailyQuest } from './dailyQuest';

interface DailyQuestGameResult {
  quest: DailyQuestState;
  reward: DailyQuestCompletionReward | null;
  profile: UserProfile | null;
}

export const dailyQuestService = {
  getTodayQuest: async (): Promise<DailyQuestState | null> => {
    const { data, error } = await supabase.rpc('get_daily_quest');
    if (error) throw error;
    return normalizeDailyQuest(data);
  },

  submitGameResult: async (input: GameRewardInput): Promise<DailyQuestGameResult> => {
    const { data, error } = await supabase.rpc('apply_daily_quest_result', {
      p_game_type: input.type,
      p_result: input,
    });
    if (error) throw error;
    const quest = normalizeDailyQuest(data?.quest);
    if (!quest) throw new Error('Не удалось получить ежедневное задание.');
    const item = data?.new_reward_item_id ? getShopItemById(data.new_reward_item_id) : undefined;
    return {
      quest,
      reward: item ? { quest, item } : null,
      profile: data?.profile ? mapProfileFromDB(data.profile) : null,
    };
  },
};
