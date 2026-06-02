import { DailyQuestKind, DailyQuestState } from '../types';

export const DAILY_QUEST_DEFINITIONS: Record<DailyQuestKind, Pick<DailyQuestState, 'title' | 'description'>> = {
  wordle_two: { title: 'Блестящая догадка', description: 'Угадай слово в Классике не более чем за 2 попытки.' },
  wordle_three: { title: 'Точная догадка', description: 'Угадай слово в Классике не более чем за 3 попытки.' },
  wordle_four: { title: 'Уверенная догадка', description: 'Угадай слово в Классике не более чем за 4 попытки.' },
  wordle_win: { title: 'Победа в Классике', description: 'Угадай любое слово в Классике.' },
  sprint_six: { title: 'Разминка на скорость', description: 'Отгадай не менее 6 слов за одну игру в Спринте.' },
  sprint_eight: { title: 'Быстрый ответ', description: 'Отгадай не менее 8 слов за одну игру в Спринте.' },
  sprint_ten: { title: 'Скоростной забег', description: 'Отгадай не менее 10 слов за одну игру в Спринте.' },
  sprint_twelve: { title: 'Молниеносный спринт', description: 'Отгадай не менее 12 слов за одну игру в Спринте.' },
  memory_twelve: { title: 'Безупречная память', description: 'Найди все пары в Памяти не более чем за 12 кликов.' },
  memory_fourteen: { title: 'Отличная память', description: 'Найди все пары в Памяти не более чем за 14 кликов.' },
  memory_sixteen: { title: 'Острая память', description: 'Найди все пары в Памяти не более чем за 16 кликов.' },
  memory_twenty: { title: 'Игра памяти', description: 'Найди все пары в Памяти не более чем за 20 кликов.' },
  hangman_perfect: { title: 'Ни одной ошибки', description: 'Победи в Виселице без ошибок.' },
  hangman_one: { title: 'Почти без промаха', description: 'Победи в Виселице, допустив не более 1 ошибки.' },
  hangman_clean: { title: 'Слово без промаха', description: 'Победи в Виселице, допустив не более 2 ошибок.' },
  hangman_win: { title: 'Спаси слово', description: 'Победи в Виселице.' },
  anagram_three: { title: 'Собери три слова', description: 'Собери 3 слова за одну игру в Анаграммах.' },
  anagram_five: { title: 'Ловкий составитель', description: 'Собери 5 слов за одну игру в Анаграммах.' },
  anagram_eight: { title: 'Мастер анаграмм', description: 'Собери 8 слов за одну игру в Анаграммах.' },
  all_five_games: { title: 'Большое приключение', description: 'За сегодня: победи в Классике и Виселице, заверши Память, собери 5 анаграмм и отгадай 6 слов в Спринте.' },
};

const modeLabels: Record<string, string> = {
  wordle: 'Классика',
  sprint: 'Спринт',
  anagram: 'Анаграммы',
  memory: 'Память',
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