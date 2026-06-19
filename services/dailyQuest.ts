import { DailyQuestKind, DailyQuestState, PetWorldId } from '../types';

type QuestCopy = Pick<DailyQuestState, 'title' | 'description'>;
export type DailyQuestTargetMode = 'game' | 'anagrams' | 'sprint' | 'memory' | 'hangman' | 'letter_square';

export const DAILY_QUEST_DEFINITIONS: Record<string, QuestCopy> = {
  wordle_two: { title: 'Блестящая догадка', description: 'Угадай слово в Классике не более чем за 2 попытки.' },
  wordle_three: { title: 'Точная догадка', description: 'Угадай слово в Классике не более чем за 3 попытки.' },
  wordle_four: { title: 'Уверенная догадка', description: 'Угадай слово в Классике не более чем за 4 попытки.' },
  wordle_win: { title: 'Победа в Классике', description: 'Угадай любое слово в Классике.' },
  sprint_four: { title: 'Быстрый старт', description: 'Отгадай не менее 4 слов за одну игру в Спринте.' },
  sprint_six: { title: 'Разминка на скорость', description: 'Отгадай не менее 6 слов за одну игру в Спринте.' },
  sprint_eight: { title: 'Быстрый ответ', description: 'Отгадай не менее 8 слов за одну игру в Спринте.' },
  sprint_ten: { title: 'Скоростной забег', description: 'Отгадай не менее 10 слов за одну игру в Спринте.' },
  sprint_twelve: { title: 'Молниеносный спринт', description: 'Отгадай не менее 12 слов за одну игру в Спринте.' },
  sprint_fourteen: { title: 'Спринтер дня', description: 'Отгадай не менее 14 слов за одну игру в Спринте.' },
  memory_twelve: { title: 'Память без промаха', description: 'Заверши Память за любое количество кликов.' },
  memory_fourteen: { title: 'Память дня', description: 'Найди все пары в Памяти. Количество кликов не ограничено.' },
  memory_sixteen: { title: 'Острая память', description: 'Найди все пары в Памяти. Главное — завершить игру.' },
  memory_eighteen: { title: 'Крепкая память', description: 'Заверши игру Память и получи награду.' },
  memory_twenty: { title: 'Игра памяти', description: 'Найди все пары в Памяти.' },
  hangman_perfect: { title: 'Ни одной ошибки', description: 'Победи в Виселице без ошибок.' },
  hangman_one: { title: 'Почти без промаха', description: 'Победи в Виселице, допустив не более 1 ошибки.' },
  hangman_clean: { title: 'Слово без промаха', description: 'Победи в Виселице, допустив не более 2 ошибок.' },
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

export const normalizeDailyQuest = (value: any): DailyQuestState | null => {
  if (!value || !value.quest_date || !value.kind) return null;
  const kind = value.kind as DailyQuestKind;
  const variantKey = typeof value.variant_key === 'string' ? value.variant_key : kind;
  const definition = DAILY_QUEST_DEFINITIONS[variantKey] || DAILY_QUEST_DEFINITIONS[kind];
  if (!definition) return null;
  const completedModes = Array.isArray(value.completed_modes) ? value.completed_modes : [];
  const rawWorldId = value.reward_world_id || value.progress?.reward_world_id;
  const rewardWorldId = validWorldIds.includes(rawWorldId as PetWorldId) ? rawWorldId as PetWorldId : null;
  return {
    questDate: value.quest_date,
    kind,
    title: definition.title,
    description: definition.description,
    progressLabel: kind === 'all_five_games'
      ? `${completedModes.length}/5: ${completedModes.map((mode: string) => modeLabels[mode] || mode).join(', ') || 'начни с любой игры'}`
      : value.completed ? 'Испытание выполнено' : 'Ещё не выполнено',
    completed: Boolean(value.completed),
    completedAt: value.completed_at || null,
    rewardItemId: value.reward_item_id || null,
    rewardWorldId,
  };
};