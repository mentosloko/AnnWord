import { DailyQuestKind, DailyQuestState, PetWorldId } from '../types';
import type { GameRewardInput } from './gamificationRules';

type QuestCopy = Pick<DailyQuestState, 'title' | 'description'>;
export type DailyQuestTargetMode = 'game' | 'anagrams' | 'sprint' | 'memory' | 'hangman' | 'letter_square';

export const DAILY_QUEST_DEFINITIONS: Record<string, QuestCopy> = {
  wordle_two: { title: 'Победа в Классике', description: 'Угадай любое слово в Классике.' },
  wordle_three: { title: 'Победа в Классике', description: 'Угадай любое слово в Классике.' },
  wordle_four: { title: 'Победа в Классике', description: 'Угадай любое слово в Классике.' },
  wordle_win: { title: 'Победа в Классике', description: 'Угадай любое слово в Классике.' },
  sprint_four: { title: 'Быстрый старт', description: 'Отгадай не менее 4 слов за одну игру в Спринте.' },
  sprint_six: { title: 'Разминка на скорость', description: 'Отгадай не менее 6 слов за одну игру в Спринте.' },
  sprint_eight: { title: 'Быстрый ответ', description: 'Отгадай не менее 8 слов за одну игру в Спринте.' },
  sprint_ten: { title: 'Скоростной забег', description: 'Отгадай не менее 10 слов за одну игру в Спринте.' },
  sprint_twelve: { title: 'Молниеносный спринт', description: 'Отгадай не менее 12 слов за одну игру в Спринте.' },
  sprint_fourteen: { title: 'Спринтер дня', description: 'Отгадай не менее 14 слов за одну игру в Спринте.' },
  memory_twelve: { title: 'Память дня', description: 'Заверши игру Память.' },
  memory_fourteen: { title: 'Память дня', description: 'Найди все пары в Памяти.' },
  memory_sixteen: { title: 'Острая память', description: 'Найди все пары в Памяти. Главное — завершить игру.' },
  memory_eighteen: { title: 'Крепкая память', description: 'Заверши игру Память и получи награду.' },
  memory_twenty: { title: 'Игра памяти', description: 'Найди все пары в Памяти.' },
  hangman_perfect: { title: 'Победа в Виселице', description: 'Победи в Виселице.' },
  hangman_one: { title: 'Победа в Виселице', description: 'Победи в Виселице.' },
  hangman_clean: { title: 'Победа в Виселице', description: 'Победи в Виселице.' },
  hangman_win: { title: 'Спаси слово', description: 'Победи в Виселице.' },
  letter_square_four: { title: 'Змейка', description: 'Собери не менее 4 слов в игре Змейка.' },
  letter_square_six: { title: 'Змейка дня', description: 'Собери не менее 6 слов в игре Змейка.' },
  all_five_games: { title: 'Большое приключение', description: 'За сегодня: победи в Классике и Виселице, заверши Память, собери 5 анаграмм и отгадай 6 слов в Спринте.' },
};

const modeLabels: Record<string, string> = { wordle: 'Классика', sprint: 'Спринт', anagram: 'Анаграммы', memory: 'Память', hangman: 'Виселица', letterSquare: 'Змейка', letter_square: 'Змейка' };
const validWorldIds: PetWorldId[] = ['default_room', 'theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge'];

export const getDailyQuestTargetModes = (quest?: Pick<DailyQuestState, 'kind' | 'title' | 'description'> | null): DailyQuestTargetMode[] => {
  if (!quest) return [];
  const text = `${quest.kind} ${quest.title} ${quest.description}`.toLowerCase();
  if (quest.kind === 'all_five_games' || text.includes('all_five_games')) return ['game', 'anagrams', 'sprint', 'memory', 'hangman'];
  if (text.includes('letter_square') || text.includes('lettersquare') || text.includes('квадрат') || text.includes('змейк')) return ['letter_square'];
  if (text.includes('hangman') || text.includes('виселиц')) return ['hangman'];
  if (text.includes('sprint') || text.includes('спринт')) return ['sprint'];
  if (text.includes('memory') || text.includes('памят')) return ['memory'];
  if (text.includes('anagram') || text.includes('анаграм')) return ['anagrams'];
  return ['game'];
};

export const getDailyQuestPrimaryMode = (quest?: Pick<DailyQuestState, 'kind' | 'title' | 'description'> | null): DailyQuestTargetMode => getDailyQuestTargetModes(quest)[0] || 'game';

const firstDefined = (...values: unknown[]): unknown => values.find(value => value !== undefined && value !== null);
const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const dateKeyOrNull = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.slice(0, 10);
};
const readCompletedModes = (value: any): string[] => {
  const raw = firstDefined(value?.completedModes, value?.completed_modes, value?.progress?.completed_modes);
  return Array.isArray(raw) ? raw.filter((mode): mode is string => typeof mode === 'string') : [];
};

export const normalizeDailyQuest = (value: any): DailyQuestState | null => {
  if (!value || typeof value !== 'object') return null;
  const questDate = dateKeyOrNull(firstDefined(value.questDate, value.quest_date));
  const kind = stringOrNull(value.kind) as DailyQuestKind | null;
  if (!questDate || !kind) return null;

  const variantKey = stringOrNull(firstDefined(value.variantKey, value.variant_key, value.progress?.variant_key)) || kind;
  const definition = DAILY_QUEST_DEFINITIONS[variantKey] || DAILY_QUEST_DEFINITIONS[kind];
  if (!definition) return null;

  const completed = Boolean(value.completed);
  const completedModes = readCompletedModes(value);
  const rawWorldId = firstDefined(value.rewardWorldId, value.reward_world_id, value.progress?.reward_world_id);
  const rewardWorldId = validWorldIds.includes(rawWorldId as PetWorldId) ? rawWorldId as PetWorldId : null;
  const progressLabel = stringOrNull(value.progressLabel) || (kind === 'all_five_games'
    ? `${completedModes.length}/5: ${completedModes.map((mode: string) => modeLabels[mode] || mode).join(', ') || 'начни с любой игры'}`
    : completed ? 'Испытание выполнено' : 'Ещё не выполнено');

  return {
    questDate,
    kind,
    title: stringOrNull(value.title) || definition.title,
    description: stringOrNull(value.description) || definition.description,
    progressLabel,
    completed,
    completedAt: stringOrNull(firstDefined(value.completedAt, value.completed_at)),
    rewardItemId: stringOrNull(firstDefined(value.rewardItemId, value.reward_item_id)),
    rewardWorldId,
  };
};

const numeric = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const truthy = (value: unknown): boolean => value === true || value === 'true';
const completedModeLabel = (input: GameRewardInput): string | null => input.type === 'wordle' && truthy(input.won) ? 'Классика' : input.type === 'sprint' && numeric(input.guessedWords) > 0 ? 'Спринт' : input.type === 'anagram' && numeric(input.guessedWords) > 0 ? 'Анаграммы' : input.type === 'memory' ? 'Память' : input.type === 'hangman' && truthy(input.won) ? 'Виселица' : null;

export const doesGameResultCompleteDailyQuest = (quest: DailyQuestState | null | undefined, input: GameRewardInput): boolean => {
  if (!quest || quest.completed) return false;
  const text = `${quest.title} ${quest.description}`.toLowerCase();
  if (quest.kind === 'wordle_four') return input.type === 'wordle' && truthy(input.won);
  if (quest.kind === 'sprint_twelve') {
    const match = text.match(/(?:не менее|отгадай)\s+(\d+)/i);
    const target = match ? Number(match[1]) : 12;
    return input.type === 'sprint' && numeric(input.guessedWords) >= target;
  }
  if (quest.kind === 'memory_sixteen') return input.type === 'memory' && numeric(input.clicks) > 0;
  if (quest.kind === 'hangman_clean') return input.type === 'hangman' && truthy(input.won);
  if (quest.kind === 'all_five_games') {
    const mode = completedModeLabel(input);
    const completedCount = Number(quest.progressLabel.match(/^(\d+)\/5/)?.[1] || 0);
    return Boolean(mode && completedCount >= 4 && !quest.progressLabel.toLowerCase().includes(mode.toLowerCase()));
  }
  return false;
};
