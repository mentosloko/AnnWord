import { DailyQuestKind, DailyQuestState } from '../types';

export const DAILY_QUEST_DEFINITIONS: Record<DailyQuestKind, Pick<DailyQuestState, 'title' | 'description'>> = {
  wordle_four: {
    title: 'Точная догадка',
    description: 'Угадай слово в Классике не более чем за 4 попытки.',
  },
  sprint_twelve: {
    title: 'Молниеносный спринт',
    description: 'Отгадай не менее 12 слов за одну игру в Спринте.',
  },
  memory_sixteen: {
    title: 'Острая память',
    description: 'Найди все пары в Мемо не более чем за 16 кликов.',
  },
  hangman_clean: {
    title: 'Слово без промаха',
    description: 'Победи в Виселице, допустив не более 2 ошибок.',
  },
  all_five_games: {
    title: 'Большое приключение',
    description: 'Победи во всех пяти играх за сегодня.',
  },
};

const modeLabels: Record<string, string> = {
  wordle: 'Классика',
  sprint: 'Спринт',
  anagram: 'Анаграммы',
  memory: 'Мемо',
  hangman: 'Виселица',
};

export const normalizeDailyQuest = (value: any): DailyQuestState | null => {
  if (!value || !value.quest_date || !value.kind) return null;
  const kind = value.kind as DailyQuestKind;
  const definition = DAILY_QUEST_DEFINITIONS[kind];
  if (!definition) return null;
  const completedModes = Array.isArray(value.completed_modes) ? value.completed_modes : [];
  const progressLabel = kind === 'all_five_games'
    ? `${completedModes.length}/5: ${completedModes.map((mode: string) => modeLabels[mode] || mode).join(', ') || 'начни с любой игры'}`
    : value.completed ? 'Испытание выполнено' : 'Ещё не выполнено';
  return {
    questDate: value.quest_date,
    kind,
    title: definition.title,
    description: definition.description,
    progressLabel,
    completed: Boolean(value.completed),
    completedAt: value.completed_at || null,
    rewardItemId: value.reward_item_id || null,
  };
};
