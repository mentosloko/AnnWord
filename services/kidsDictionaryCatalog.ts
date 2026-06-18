import { DifficultyLevel, EnrichedWord } from '../types';

export type KidsDictionaryId =
  | 'kids_grade_1'
  | 'kids_grade_2'
  | 'kids_grade_3'
  | 'kids_animals'
  | 'kids_food_home'
  | 'kids_school_daily';

export interface KidsDictionaryMeta {
  id: KidsDictionaryId;
  title: string;
  shortTitle: string;
  theme: string;
  icon: string;
  wordCount: number;
  levelCounts?: Partial<Record<DifficultyLevel, number>>;
}

type KidsDictionaryFile = Omit<KidsDictionaryMeta, 'wordCount' | 'levelCounts'> & { words: EnrichedWord[] };

const entry = (word: string, translation: string, level: Exclude<DifficultyLevel, 'ALL'> = 'A1'): EnrichedWord => ({ word, translation, level });

const FREE_KIDS_WORDS: EnrichedWord[] = [
  entry('APPLE', 'яблоко'), entry('BABY', 'малыш'), entry('BALL', 'мяч'), entry('BEAR', 'медведь'), entry('BIRD', 'птица'), entry('BOOK', 'книга'), entry('CAKE', 'торт'), entry('CAT', 'кот'), entry('CHAIR', 'стул'), entry('CLOUD', 'облако'), entry('DOG', 'собака'), entry('DOOR', 'дверь'), entry('DUCK', 'утка'), entry('FISH', 'рыба'), entry('GAME', 'игра'), entry('GIRL', 'девочка'), entry('HAPPY', 'счастливый'), entry('HOUSE', 'дом'), entry('JUICE', 'сок'), entry('MILK', 'молоко'), entry('MOON', 'луна'), entry('MOUSE', 'мышь'), entry('PANDA', 'панда'), entry('PIZZA', 'пицца'), entry('ROBOT', 'робот'), entry('SCHOOL', 'школа'), entry('SMILE', 'улыбка'), entry('STAR', 'звезда'), entry('SUN', 'солнце'), entry('TABLE', 'стол'), entry('TEDDY', 'плюшевый мишка'), entry('TRAIN', 'поезд'), entry('TREE', 'дерево'), entry('WATER', 'вода'), entry('YUMMY', 'вкусный'),
];

const premiumDictionaries: Record<KidsDictionaryId, KidsDictionaryFile> = {
  kids_grade_1: {
    id: 'kids_grade_1', title: '1 класс: первые слова', shortTitle: '1 класс', theme: 'grade', icon: '1️⃣',
    words: [entry('APPLE', 'яблоко'), entry('BALL', 'мяч'), entry('BOOK', 'книга'), entry('CAKE', 'торт'), entry('CAT', 'кот'), entry('DOG', 'собака'), entry('FISH', 'рыба'), entry('FROG', 'лягушка'), entry('HAND', 'рука'), entry('MILK', 'молоко'), entry('PEN', 'ручка'), entry('SUN', 'солнце'), entry('TOY', 'игрушка'), entry('TREE', 'дерево'), entry('WATER', 'вода'), entry('YUMMY', 'вкусный')],
  },
  kids_grade_2: {
    id: 'kids_grade_2', title: '2 класс: школа и дом', shortTitle: '2 класс', theme: 'grade', icon: '2️⃣',
    words: [entry('CHAIR', 'стул'), entry('CLASS', 'класс', 'A2'), entry('CLOCK', 'часы', 'A2'), entry('DOOR', 'дверь'), entry('DRESS', 'платье', 'A2'), entry('FRIDAY', 'пятница', 'A2'), entry('FRIEND', 'друг', 'A2'), entry('HOUSE', 'дом'), entry('LIGHT', 'свет', 'A2'), entry('MUSIC', 'музыка', 'A2'), entry('PAPER', 'бумага', 'A2'), entry('PENCIL', 'карандаш', 'A2'), entry('SCHOOL', 'школа'), entry('SUNDAY', 'воскресенье', 'A2'), entry('TABLE', 'стол'), entry('TEACH', 'учить', 'A2')],
  },
  kids_grade_3: {
    id: 'kids_grade_3', title: '3 класс: чтение и истории', shortTitle: '3 класс', theme: 'grade', icon: '3️⃣',
    words: [entry('ADVENTURE', 'приключение', 'B1'), entry('BEACH', 'пляж', 'A2'), entry('BRAVE', 'смелый', 'A2'), entry('CAMP', 'лагерь', 'A2'), entry('CASTLE', 'замок', 'B1'), entry('FOREST', 'лес', 'A2'), entry('HAPPY', 'счастливый'), entry('MAGIC', 'магия', 'A2'), entry('PICNIC', 'пикник', 'A2'), entry('PIRATE', 'пират', 'A2'), entry('PLANET', 'планета', 'A2'), entry('PUZZLE', 'головоломка', 'A2'), entry('ROCKET', 'ракета', 'A2'), entry('STORY', 'история', 'A2'), entry('TICKET', 'билет', 'A2'), entry('TRAVEL', 'путешествие', 'B1')],
  },
  kids_animals: {
    id: 'kids_animals', title: 'Животные', shortTitle: 'Животные', theme: 'topic', icon: '🐾',
    words: [entry('BEAR', 'медведь'), entry('BIRD', 'птица'), entry('CAMEL', 'верблюд', 'A2'), entry('CAT', 'кот'), entry('CHICK', 'цыплёнок'), entry('DOG', 'собака'), entry('DUCK', 'утка'), entry('FISH', 'рыба'), entry('FROG', 'лягушка'), entry('HORSE', 'лошадь', 'A2'), entry('KOALA', 'коала', 'A2'), entry('LION', 'лев', 'A2'), entry('MONKEY', 'обезьяна', 'A2'), entry('MOUSE', 'мышь'), entry('PANDA', 'панда'), entry('TIGER', 'тигр', 'A2'), entry('WHALE', 'кит', 'A2'), entry('ZEBRA', 'зебра', 'A2')],
  },
  kids_food_home: {
    id: 'kids_food_home', title: 'Еда и дом', shortTitle: 'Еда/дом', theme: 'topic', icon: '🍽️',
    words: [entry('APPLE', 'яблоко'), entry('BERRY', 'ягода', 'A2'), entry('BREAD', 'хлеб', 'A2'), entry('BURGER', 'бургер', 'A2'), entry('CANDY', 'конфета', 'A2'), entry('CHAIR', 'стул'), entry('CHEESE', 'сыр', 'A2'), entry('COOKIE', 'печенье', 'A2'), entry('DOOR', 'дверь'), entry('FAMILY', 'семья', 'A2'), entry('HOUSE', 'дом'), entry('JUICE', 'сок'), entry('KITCHEN', 'кухня', 'A2'), entry('LEMON', 'лимон', 'A2'), entry('MILK', 'молоко'), entry('PIZZA', 'пицца'), entry('TABLE', 'стол'), entry('WATER', 'вода')],
  },
  kids_school_daily: {
    id: 'kids_school_daily', title: 'Школа и день', shortTitle: 'Школа', theme: 'topic', icon: '🎒',
    words: [entry('BOARD', 'доска', 'A2'), entry('BOOK', 'книга'), entry('CLASS', 'класс', 'A2'), entry('COLOR', 'цвет', 'A2'), entry('COUNT', 'считать', 'A2'), entry('DRAW', 'рисовать'), entry('ENGLISH', 'английский', 'A2'), entry('FRIDAY', 'пятница', 'A2'), entry('LESSON', 'урок', 'A2'), entry('LETTER', 'буква', 'A2'), entry('MUSIC', 'музыка', 'A2'), entry('PAPER', 'бумага', 'A2'), entry('PENCIL', 'карандаш', 'A2'), entry('READ', 'читать'), entry('SCHOOL', 'школа'), entry('SUNDAY', 'воскресенье', 'A2'), entry('TEACH', 'учить', 'A2'), entry('WRITE', 'писать', 'A2')],
  },
};

const matchesDifficulty = (entry: EnrichedWord, difficulty: DifficultyLevel = 'ALL') => difficulty === 'ALL' || entry.level === difficulty;
const normalizeEntry = (item: EnrichedWord): EnrichedWord => ({ ...item, word: item.word.trim().toUpperCase().replace(/[^A-Z]/g, '') });
const uniqueEntries = (items: EnrichedWord[]): EnrichedWord[] => {
  const seen = new Set<string>();
  return items.map(normalizeEntry).filter(item => {
    if (!item.word || seen.has(item.word)) return false;
    seen.add(item.word);
    return true;
  });
};
const withCounts = (item: KidsDictionaryFile): KidsDictionaryMeta => {
  const entries = uniqueEntries(item.words);
  const levelCounts = entries.reduce<Partial<Record<DifficultyLevel, number>>>((acc, word) => {
    const level = word.level as DifficultyLevel;
    acc[level] = (acc[level] || 0) + 1;
    acc.ALL = (acc.ALL || 0) + 1;
    return acc;
  }, {});
  return { id: item.id, title: item.title, shortTitle: item.shortTitle, theme: item.theme, icon: item.icon, wordCount: entries.length, levelCounts };
};

export const getFreeKidsDictionaryEntries = (difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] =>
  uniqueEntries(FREE_KIDS_WORDS).filter(item => matchesDifficulty(item, difficulty));

export const getDefaultKidsDictionaryId = (): KidsDictionaryId => 'kids_grade_1';

export const getKidsDictionaryCatalog = (): KidsDictionaryMeta[] => Object.values(premiumDictionaries).map(withCounts);

export const getKidsDictionaryMeta = (id?: string): KidsDictionaryMeta =>
  getKidsDictionaryCatalog().find(item => item.id === id) || getKidsDictionaryCatalog()[0];

export const getKidsPremiumDictionaryEntries = (id?: string, difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] => {
  const dictionaryId = (premiumDictionaries[id as KidsDictionaryId] ? id : getDefaultKidsDictionaryId()) as KidsDictionaryId;
  return uniqueEntries(premiumDictionaries[dictionaryId].words).filter(item => matchesDifficulty(item, difficulty));
};

export const getKidsPremiumDictionaryWords = (id?: string, difficulty: DifficultyLevel = 'ALL'): string[] =>
  getKidsPremiumDictionaryEntries(id, difficulty).map(item => item.word);

export const getAllKidsDictionaryWords = (): string[] => Array.from(new Set([
  ...getFreeKidsDictionaryEntries('ALL').map(item => item.word),
  ...Object.keys(premiumDictionaries).flatMap(id => getKidsPremiumDictionaryWords(id, 'ALL')),
]));
