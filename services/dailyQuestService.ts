import type { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../types';
import type { GameRewardInput } from './gamificationRules';
import { normalizeDailyQuest } from './dailyQuest';
import { backendApiRequest } from './backendApiClient';

interface DailyQuestGameResult {
  quest: DailyQuestState;
  reward: DailyQuestCompletionReward | null;
  profile: UserProfile | null;
}

let primedTodayQuest: DailyQuestState | null | undefined;

export const dailyQuestService = {
  primeTodayQuest: (quest: DailyQuestState | null | undefined): void => {
    primedTodayQuest = quest === undefined ? undefined : normalizeDailyQuest(quest);
  },

  getTodayQuest: async (): Promise<DailyQuestState | null> => {
    if (primedTodayQuest !== undefined) {
      const quest = primedTodayQuest;
      primedTodayQuest = undefined;
      return quest;
    }
    const data = await backendApiRequest<{ quest: DailyQuestState }>('/api/daily-quest/today');
    return normalizeDailyQuest(data.quest);
  },

  submitGameResult: async (input: GameRewardInput): Promise<DailyQuestGameResult> => {
    const data = await backendApiRequest<DailyQuestGameResult>('/api/daily-quest/result', {
      method: 'POST',
      body: input,
    });
    const quest = normalizeDailyQuest(data.quest);
    if (!quest) throw new Error('Не удалось получить ежедневное задание.');
    return { ...data, quest };
  },
};
