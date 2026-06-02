import { DailyQuestKind, DailyQuestState } from '../types';

export const DAILY_QUEST_DEFINITIONS: Record<DailyQuestKind, Pick<DailyQuestState, 'title' | 'description'>> = {
  wordle_win: { title: 'Разминка со словом', description: 'Угадай одно слово в Классике.' },
  wordle_four: { title: 'Точная догадка', description: 'Угадай слово в Классике не более чем за 4 попытки.' },
  wordle_three: { title: 'Слово с полуслова', description: 'Угадай слово в Классике не более чем за 3 попытки.' },
  sprint_six: { title: 'Быстрый старт', description: 'Отгадай не менее 6 слов за одну игру в Спринте.' },
  sprint_nine: { title: 'Ускорение', description: 'Отгадай не менее 9 слов за одну игру в Спринте.' },
  sprint_twelve: { title: 'Молниеносный спринт', description: 'Отгадай не менее 12 слов за одну игру в Спринте.' },
  sprint_fifteen: { title: 'Скорость света', description: 'Отгадай не менее 15 слов за одну игру в Спринте.' },
  memory_complete: { title: 'Найди все пары', description: 'Заверши одну игру в Память.' },
  memory_twenty: { title: 'Хорошая память', description: 'Найди все пары в Памяти не более чем за 20 кликов.' },
  memory_sixteen: { title: 'Острая память', description: 'Найди все пары в Памяти не более чем за 16 кликов.' },
  memory_twelve: { title: 'Фотографическая память', description: 'Найди все пары в Памяти не более чем за 12 кликов.' },
  hangman_win: { title: 'Спасённое слово', description: 'Победи один раз в Виселице.' },
  hangman_three: { title: 'Осторожный игрок', description: 'Победи в Виселице, допустив не более 3 ошибок.' },
  hangman_one_mistake: { title: 'Почти без ошибки', description: 'Победи в Виселице, допустив не более 1 ошибки.' },
  hangman_clean: { title: 'Слово без промаха', description: 'Победи в Виселице, допустив не более 2 ошибок.' },
  anagram_five: { title: 'Первая перестановка', description: 'Собери 5 слов в Анаграммах за сегодня.' },
  anagram_ten: { title: 'Ловкий сборщик', description: 'Собери 10 слов в Анаграммах за сегодня.' },
  anagram_fifteen: { title: 'Мастер анаграмм', description: 'Собери 15 слов в Анаграммах за сегодня.' },
  anagram_twenty: { title: 'Король перестановок', description: 'Собери 20 слов в Анаграммах за сегодня.' },
  all_five_games: { title: 'Большое приключение', description: 'За сегодня: победи в Классике и Виселице, заверши Память, собери 5 анаграмм и отгадай 6 слов в Спринте.' },
};

const modeLabels: Record<string, string> = {
  wordle: 'Классика',
  sprint: 'Спринт',
  anagram: 'Анаграммы',
  memory: 'Память',
  hangman: 'Виселица',
};

const ANAGRAM_TARGETS: Partial<Record<DailyQuestKind, number>> = {
  anagram_five: 5,
  anagram_ten: 10,
  anagram_fifteen: 15,
  anagram_twenty: 20,
};

export const normalizeDailyQuest = (value: any): DailyQuestState | null => {
  if (!value || !value.quest_date || !value.kind) return null;
  const kind = value.kind as DailyQuestKind;
  const definition = DAILY_QUEST_DEFINITIONS[kind];
  if (!definition) return null;
  const completedModes = Array.isArray(value.completed_modes) ? value.completed_modes : [];
  const anagramWords = Math.max(0, Number(value.progress?.anagram_words) || 0);
  const anagramTarget = ANAGRAM_TARGETS[kind];
  const progressLabel = kind === 'all_five_games'
    ? `${completedModes.length}/5: ${completedModes.map((mode: string) => modeLabels[mode] || mode).join(', ') || 'начни с любой игры'}`
    : anagramTarget
      ? `${Math.min(anagramWords, anagramTarget)}/${anagramTarget} слов собрано`
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