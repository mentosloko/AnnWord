import { supabase } from '../supabase';
import { DailyQuestCompletionReward, DailyQuestKind, DailyQuestState, PetWorldId, UserProfile } from '../types';
import { GameRewardInput } from './gamificationRules';
import { mapProfileFromDB } from './profileMapper';
import { getShopItemById } from './shopCatalog';
import { DAILY_QUEST_DEFINITIONS, normalizeDailyQuest } from './dailyQuest';
import { isBackendApiConfigured } from './backendApiClient';

interface DailyQuestGameResult {
  quest: DailyQuestState;
  reward: DailyQuestCompletionReward | null;
  profile: UserProfile | null;
}

const WORLD_IDS: PetWorldId[] = ['theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge'];
const normalizeWorldId = (value: unknown): PetWorldId | null =>
  WORLD_IDS.includes(value as PetWorldId) ? value as PetWorldId : null;

const LOCAL_COMPLETED_KEY_PREFIX = 'annword_local_daily_quest_completed:';
const LOCAL_QUESTS: DailyQuestKind[] = ['wordle_four', 'sprint_twelve', 'memory_sixteen', 'hangman_clean'];

const today = (): string => new Date().toISOString().slice(0, 10);
const hashDate = (date: string): number => Array.from(date).reduce((sum, char) => sum + char.charCodeAt(0), 0);
const localQuestKindForDate = (date: string): DailyQuestKind => LOCAL_QUESTS[hashDate(date) % LOCAL_QUESTS.length];
const localCompletedKey = (date: string): string => `${LOCAL_COMPLETED_KEY_PREFIX}${date}`;

const readLocalCompletion = (date: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(localCompletedKey(date)) === 'true';
  } catch {
    return false;
  }
};

const writeLocalCompletion = (date: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localCompletedKey(date), 'true');
  } catch {
    // Daily quest fallback must not break gameplay.
  }
};

const buildLocalQuest = (date = today(), completed = readLocalCompletion(date)): DailyQuestState => {
  const kind = localQuestKindForDate(date);
  const definition = DAILY_QUEST_DEFINITIONS[kind];
  return {
    questDate: date,
    kind,
    title: definition.title,
    description: definition.description,
    progressLabel: completed ? 'Испытание выполнено' : 'Ещё не выполнено',
    completed,
    completedAt: completed ? date : null,
    rewardItemId: null,
    rewardWorldId: null,
  };
};

const isLocalQuestCompletedByResult = (quest: DailyQuestState, input: GameRewardInput): boolean => {
  if (quest.completed) return true;
  if (quest.kind === 'wordle_four') return input.type === 'wordle' && Boolean(input.won) && Math.max(1, Math.round(input.attempts || 6)) <= 4;
  if (quest.kind === 'sprint_twelve') return input.type === 'sprint' && Math.max(0, Math.round(input.guessedWords || 0)) >= 12;
  if (quest.kind === 'memory_sixteen') return input.type === 'memory' && Math.max(0, Math.round(input.clicks || 0)) > 0;
  if (quest.kind === 'hangman_clean') return input.type === 'hangman' && Boolean(input.won) && Math.max(0, Math.round(input.mistakes || 0)) <= 2;
  return false;
};

export const dailyQuestService = {
  getTodayQuest: async (): Promise<DailyQuestState | null> => {
    if (isBackendApiConfigured) return buildLocalQuest();
    const { data, error } = await supabase.rpc('get_daily_quest');
    if (error) throw error;
    return normalizeDailyQuest(data);
  },

  submitGameResult: async (input: GameRewardInput): Promise<DailyQuestGameResult> => {
    if (isBackendApiConfigured) {
      const date = today();
      const quest = buildLocalQuest(date);
      const completed = isLocalQuestCompletedByResult(quest, input);
      if (completed) writeLocalCompletion(date);
      return { quest: buildLocalQuest(date, completed), reward: null, profile: null };
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
