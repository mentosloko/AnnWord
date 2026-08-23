import type { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../types';
import type { GameRewardInput } from './gamificationRules';
import { normalizeDailyQuest } from './dailyQuest';
import { backendApiRequest } from './backendApiClient';

interface DailyQuestGameResult {
  quest: DailyQuestState;
  reward: DailyQuestCompletionReward | null;
  profile: UserProfile | null;
}

const QUEST_CACHE_TTL_MS = 60_000;
let primedTodayQuest: DailyQuestState | null | undefined;
let primedAt = 0;

const cacheQuest = (quest: DailyQuestState | null | undefined): void => {
  primedTodayQuest = quest === undefined ? undefined : normalizeDailyQuest(quest);
  primedAt = quest === undefined ? 0 : Date.now();
};

export const dailyQuestService = {
  primeTodayQuest: (quest: DailyQuestState | null | undefined): void => {
    cacheQuest(quest);
  },

  getTodayQuest: async (): Promise<DailyQuestState | null> => {
    if (primedTodayQuest !== undefined && Date.now() - primedAt < QUEST_CACHE_TTL_MS) {
      return primedTodayQuest;
    }
    const data = await backendApiRequest<{ quest: DailyQuestState }>('/api/daily-quest/today');
    const quest = normalizeDailyQuest(data.quest);
    cacheQuest(quest);
    return quest;
  },

  submitGameResult: async (input: GameRewardInput): Promise<DailyQuestGameResult> => {
    const data = await backendApiRequest<DailyQuestGameResult>('/api/daily-quest/result', {
      method: 'POST',
      body: input,
    });
    const quest = normalizeDailyQuest(data.quest);
    if (!quest) throw new Error('Не удалось получить ежедневное задание.');
    cacheQuest(quest);
    return { ...data, quest };
  },
};
