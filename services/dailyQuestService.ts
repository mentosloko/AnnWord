import type { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../types';
import type { GameRewardInput } from './gamificationRules';
import { normalizeDailyQuest } from './dailyQuest';
import { backendApiRequest } from './backendApiClient';

export interface DailyQuestGameResult {
  quest: DailyQuestState;
  reward: DailyQuestCompletionReward | null;
  profile: UserProfile | null;
}

const QUEST_CACHE_TTL_MS = 60_000;
let primedTodayQuest: DailyQuestState | null | undefined;
let primedAt = 0;
let pendingClassicCommits: Array<Promise<DailyQuestGameResult | null>> = [];

const cacheQuest = (quest: DailyQuestState | null | undefined): void => {
  primedTodayQuest = quest === undefined ? undefined : normalizeDailyQuest(quest);
  primedAt = quest === undefined ? 0 : Date.now();
};

export const dailyQuestService = {
  primeTodayQuest: (quest: DailyQuestState | null | undefined): void => {
    cacheQuest(quest);
    if (quest === undefined) pendingClassicCommits = [];
  },

  registerClassicResultCommit: (commit: Promise<DailyQuestGameResult | null>): void => {
    pendingClassicCommits.push(commit);
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
    if (input.type === 'wordle' && pendingClassicCommits.length > 0) {
      const commit = pendingClassicCommits.shift()!;
      const result = await commit;
      if (!result) {
        throw new Error('Результат Классики сохранён локально и будет синхронизирован при восстановлении связи.');
      }
      cacheQuest(result.quest);
      return result;
    }

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
