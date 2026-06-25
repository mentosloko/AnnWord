import { query } from "./db";
import { getProfileById } from "./profileRepository";
import type { DailyQuestKind, DailyQuestState, UserProfile } from "../types";
import type { GameRewardInput } from "../services/gamificationRules";
import { DAILY_QUEST_DEFINITIONS } from "../services/dailyQuest";

type DailyQuestRow = {
  user_id: string;
  quest_date: string | Date;
  kind: DailyQuestKind;
  progress: Record<string, unknown> | null;
  completed: boolean;
  completed_at: string | Date | null;
  reward_item_id: string | null;
  reward_world_id: string | null;
};

type DailyQuestWithVariant = DailyQuestState & { variantKey?: string };

export type DailyQuestResult = {
  quest: DailyQuestState;
  reward: null;
  profile: UserProfile | null;
};

const QUEST_VARIANTS: Array<{ kind: DailyQuestKind; variantKey: string }> = [
  { kind: "wordle_four", variantKey: "wordle_two" },
  { kind: "wordle_four", variantKey: "wordle_three" },
  { kind: "wordle_four", variantKey: "wordle_four" },
  { kind: "wordle_four", variantKey: "wordle_win" },
  { kind: "sprint_twelve", variantKey: "sprint_four" },
  { kind: "sprint_twelve", variantKey: "sprint_six" },
  { kind: "sprint_twelve", variantKey: "sprint_eight" },
  { kind: "sprint_twelve", variantKey: "sprint_ten" },
  { kind: "sprint_twelve", variantKey: "sprint_twelve" },
  { kind: "sprint_twelve", variantKey: "sprint_fourteen" },
  { kind: "memory_sixteen", variantKey: "memory_twelve" },
  { kind: "memory_sixteen", variantKey: "memory_fourteen" },
  { kind: "memory_sixteen", variantKey: "memory_sixteen" },
  { kind: "memory_sixteen", variantKey: "memory_eighteen" },
  { kind: "memory_sixteen", variantKey: "memory_twenty" },
  { kind: "hangman_clean", variantKey: "hangman_perfect" },
  { kind: "hangman_clean", variantKey: "hangman_one" },
  { kind: "hangman_clean", variantKey: "hangman_clean" },
  { kind: "hangman_clean", variantKey: "hangman_win" },
  { kind: "all_five_games", variantKey: "all_five_games" },
];

const modeLabels: Record<string, string> = { wordle: "Классика", sprint: "Спринт", anagram: "Анаграммы", memory: "Память", hangman: "Виселица", letter_square: "Змейка", letterSquare: "Змейка" };
const MOSCOW_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });

function todayKey(date = new Date()): string {
  const parts = MOSCOW_DATE_FORMAT.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
}

function formatDate(value: string | Date): string {
  return value instanceof Date ? todayKey(value) : String(value).slice(0, 10);
}

function formatDateTime(value: string | Date | null): string | null {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function stableIndex(input: string, modulo: number): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
}

function pickVariant(userId: string, questDate: string) {
  return QUEST_VARIANTS[stableIndex(`${userId}:${questDate}:daily-quest-v3`, QUEST_VARIANTS.length)];
}

function getVariantKey(progress: Record<string, unknown>, kind: DailyQuestKind): string {
  return typeof progress.variant_key === "string" ? progress.variant_key : kind;
}

function readCompletedModes(progress: Record<string, unknown>): string[] {
  return Array.isArray(progress.completed_modes)
    ? Array.from(new Set(progress.completed_modes.filter((mode): mode is string => typeof mode === "string")))
    : [];
}

function toQuest(row: DailyQuestRow): DailyQuestWithVariant {
  const progress = row.progress || {};
  const variantKey = getVariantKey(progress, row.kind);
  const completedModes = readCompletedModes(progress);
  const definition = DAILY_QUEST_DEFINITIONS[variantKey] || DAILY_QUEST_DEFINITIONS[row.kind];
  return {
    questDate: formatDate(row.quest_date),
    kind: row.kind,
    title: definition?.title || "Ежедневное задание",
    description: definition?.description || "Выполни тренировку сегодня.",
    progressLabel: row.kind === "all_five_games"
      ? `${completedModes.length}/5: ${completedModes.map((mode) => modeLabels[mode] || mode).join(", ") || "начни с любой игры"}`
      : row.completed ? "Испытание выполнено" : "Ещё не выполнено",
    completed: Boolean(row.completed),
    completedAt: formatDateTime(row.completed_at),
    rewardItemId: row.reward_item_id,
    rewardWorldId: row.reward_world_id as DailyQuestState["rewardWorldId"],
    variantKey,
  };
}

export async function getOrCreateDailyQuest(userId: string): Promise<DailyQuestWithVariant> {
  const questDate = todayKey();
  const existing = await query<DailyQuestRow>(
    `select user_id, quest_date, kind, progress, completed, completed_at, reward_item_id, reward_world_id
       from daily_quests
      where user_id = $1 and quest_date = $2`,
    [userId, questDate],
  );
  if (existing.rows[0]) return toQuest(existing.rows[0]);

  const variant = pickVariant(userId, questDate);
  const progress = variant.kind === "all_five_games"
    ? { variant_key: variant.variantKey, completed_modes: [] }
    : { variant_key: variant.variantKey };
  const created = await query<DailyQuestRow>(
    `insert into daily_quests (user_id, quest_date, kind, progress)
     values ($1, $2, $3, $4::jsonb)
     on conflict (user_id, quest_date) do update set progress = daily_quests.progress
     returning user_id, quest_date, kind, progress, completed, completed_at, reward_item_id, reward_world_id`,
    [userId, questDate, variant.kind, JSON.stringify(progress)],
  );
  return toQuest(created.rows[0]);
}

function numberFrom(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolFrom(value: unknown): boolean {
  return value === true || value === "true";
}

function completedModeFromInput(input: GameRewardInput): string | null {
  if (input.type === "wordle" && boolFrom(input.won)) return "wordle";
  if (input.type === "sprint" && numberFrom(input.guessedWords) > 0) return "sprint";
  if (input.type === "anagram" && numberFrom(input.guessedWords) > 0) return "anagram";
  if (input.type === "memory" && (boolFrom((input as { won?: unknown }).won) || numberFrom(input.clicks) > 0)) return "memory";
  if (input.type === "hangman" && boolFrom(input.won)) return "hangman";
  return null;
}

function qualifies(quest: DailyQuestWithVariant, input: GameRewardInput): boolean {
  const variantKey = quest.variantKey || quest.kind;
  if (quest.completed) return true;
  if (quest.kind === "wordle_four") {
    if (variantKey === "wordle_win") return input.type === "wordle" && boolFrom(input.won);
    const target = variantKey === "wordle_two" ? 2 : variantKey === "wordle_three" ? 3 : 4;
    return input.type === "wordle" && boolFrom(input.won) && numberFrom(input.attempts, 99) <= target;
  }
  if (quest.kind === "sprint_twelve") {
    const target = variantKey === "sprint_four" ? 4 : variantKey === "sprint_six" ? 6 : variantKey === "sprint_eight" ? 8 : variantKey === "sprint_ten" ? 10 : variantKey === "sprint_fourteen" ? 14 : 12;
    return input.type === "sprint" && numberFrom(input.guessedWords) >= target;
  }
  if (quest.kind === "memory_sixteen") {
    return input.type === "memory" && numberFrom(input.clicks) > 0;
  }
  if (quest.kind === "hangman_clean") {
    if (variantKey === "hangman_win") return input.type === "hangman" && boolFrom(input.won);
    const target = variantKey === "hangman_perfect" ? 0 : variantKey === "hangman_one" ? 1 : 2;
    return input.type === "hangman" && boolFrom(input.won) && numberFrom(input.mistakes, 99) <= target;
  }
  return false;
}

export async function applyDailyQuestResult(userId: string, input: GameRewardInput): Promise<DailyQuestResult> {
  const questDate = todayKey();
  const quest = await getOrCreateDailyQuest(userId);
  let completed = qualifies(quest, input);

  if (quest.kind === "all_five_games" && !quest.completed) {
    const rowResult = await query<DailyQuestRow>(
      `select user_id, quest_date, kind, progress, completed, completed_at, reward_item_id, reward_world_id
         from daily_quests
        where user_id = $1 and quest_date = $2
        for update`,
      [userId, questDate],
    );
    const row = rowResult.rows[0];
    const progress = row?.progress || { variant_key: "all_five_games", completed_modes: [] };
    const mode = completedModeFromInput(input);
    const completedModes = mode ? Array.from(new Set([...readCompletedModes(progress), mode])) : readCompletedModes(progress);
    progress.completed_modes = completedModes;
    const updatedProgress = await query<DailyQuestRow>(
      `update daily_quests
          set progress = $3::jsonb,
              updated_at = now()
        where user_id = $1 and quest_date = $2
        returning user_id, quest_date, kind, progress, completed, completed_at, reward_item_id, reward_world_id`,
      [userId, questDate, JSON.stringify(progress)],
    );
    completed = readCompletedModes(updatedProgress.rows[0]?.progress || {}).length >= 5;
  }

  if (!completed) return { quest: await getOrCreateDailyQuest(userId), reward: null, profile: null };

  const updated = await query<DailyQuestRow>(
    `update daily_quests
        set completed = true,
            completed_at = coalesce(completed_at, now()),
            updated_at = now()
      where user_id = $1 and quest_date = $2
      returning user_id, quest_date, kind, progress, completed, completed_at, reward_item_id, reward_world_id`,
    [userId, questDate],
  );
  return { quest: toQuest(updated.rows[0]), reward: null, profile: await getProfileById(userId) };
}