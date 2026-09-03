import type { DifficultyLevel, EnrichedWord } from '../types';
import animalsTheme from '../dictionaries/kids/themes/kids_animals.json';
import foodTheme from '../dictionaries/kids/themes/kids_food.json';
import homeTheme from '../dictionaries/kids/themes/kids_home.json';
import schoolTheme from '../dictionaries/kids/themes/kids_school.json';
import familyTheme from '../dictionaries/kids/themes/kids_family_friends.json';
import natureTheme from '../dictionaries/kids/themes/kids_nature_weather.json';
import transportTheme from '../dictionaries/kids/themes/kids_transport_travel.json';
import hobbiesTheme from '../dictionaries/kids/themes/kids_games_hobbies.json';
import { readGeneralDictionary } from './dictionaryRuntime';
import { getKidsCefrEntries } from './kidsCefrDictionary';

export type KidsDictionaryId =
  | 'kids_animals' | 'kids_food' | 'kids_home' | 'kids_school'
  | 'kids_family_friends' | 'kids_nature_weather' | 'kids_transport_travel'
  | 'kids_games_hobbies';

export interface KidsDictionaryMeta {
  id: KidsDictionaryId;
  title: string;
  shortTitle: string;
  theme: string;
  icon: string;
  wordCount: number;
  levelCounts?: Partial<Record<DifficultyLevel, number>>;
}

type KidsThemeWord = string | {
  word: string;
  translation?: string;
  level?: Exclude<DifficultyLevel, 'ALL'>;
};

type KidsDictionaryDefinition = Omit<KidsDictionaryMeta, 'wordCount' | 'levelCounts'> & { words: KidsThemeWord[] };

const FREE_KIDS_TARGET = 150;

// Words absent from the shared catalogue can be added here only when their
// translation has already been verified. Theme JSON files also support inline
// { word, translation, level } entries for future manual additions.
const KIDS_TRANSLATION_FALLBACKS: EnrichedWord[] = [
  { word: 'PANDA', translation: 'панда', level: 'A1' },
];

const FREE_KIDS_SEEDS = [
  'APPLE','BABY','BALL','BEAR','BIRD','BOOK','CAKE','CAT','CHAIR','CLOUD','DOG','DOOR','DUCK','FISH','GAME','GIRL','HAPPY','HOUSE','JUICE','MILK','MOON','MOUSE','PANDA','PIZZA','ROBOT','SCHOOL','SMILE','STAR','SUN','TABLE','TEDDY','TRAIN','TREE','WATER','YUMMY',
  'AIRPLANE','ANT','ARM','BAG','BANANA','BATH','BED','BEE','BICYCLE','BLUE','BOAT','BREAD','BROTHER','BUS','BUTTER','CAR','CARROT','CHEESE','CHICKEN','CHILD','CLASS','CLOCK','COAT','COLOR','COOKIE','COW','DANCE','DAY','DOLL','DRESS','EAR','EGG','ELEPHANT','EYE','FACE','FAMILY','FARM','FATHER','FLOWER','FOOT','FROG','FRIEND','FROST','GARDEN','GOAT','GREEN','HAND','HAT','HEAD','HEART','HORSE','ICE','JACKET','KITCHEN','KITE','LAMP','LEMON','LION','MANGO','MOTHER','MUSIC','NIGHT','NOSE','ORANGE','PAPER','PARK','PENCIL','PEN','PIG','PLANE','PLAY','RAIN','RED','RIVER','ROOM','SAND','SHEEP','SHOE','SISTER','SKY','SNOW','SONG','SPOON','STREET','SWIM','TEACHER','TIGER','TOY','UMBRELLA','VILLAGE','WALL','WATCH','WEATHER','WINDOW','WIND','WRITE','YELLOW','ZEBRA',
];

const themeDefinitions = [
  animalsTheme,
  foodTheme,
  homeTheme,
  schoolTheme,
  familyTheme,
  natureTheme,
  transportTheme,
  hobbiesTheme,
] as unknown as KidsDictionaryDefinition[];

const dictionaries = Object.fromEntries(
  themeDefinitions.map(item => [item.id, item]),
) as Record<KidsDictionaryId, KidsDictionaryDefinition>;

const normalize = (word: string): string => word.trim().toUpperCase().replace(/[^A-Z]/g, '');

const generalKidsFoundation = (): EnrichedWord[] => getKidsCefrEntries([
  ...(readGeneralDictionary()?.COMMON_WORDS_EN || []),
  ...KIDS_TRANSLATION_FALLBACKS,
]);

const uniqueEntries = (items: EnrichedWord[]): EnrichedWord[] => {
  const seen = new Set<string>();
  return items.filter(entry => !seen.has(entry.word) && seen.add(entry.word));
};

const resolveThemeEntry = (raw: KidsThemeWord, byWord: Map<string, EnrichedWord>): EnrichedWord | null => {
  if (typeof raw === 'string') return byWord.get(normalize(raw)) || null;
  const word = normalize(raw.word || '');
  if (!word) return null;
  const fromMaster = byWord.get(word);
  const translation = raw.translation?.trim();
  if (!translation) return fromMaster || null;
  const candidate: EnrichedWord = {
    word,
    translation,
    level: raw.level || fromMaster?.level || 'A1',
  };
  return getKidsCefrEntries([candidate])[0] || null;
};

const buildThemeEntries = (definition: KidsDictionaryDefinition): EnrichedWord[] => {
  const byWord = new Map(generalKidsFoundation().map(entry => [normalize(entry.word), entry]));
  return uniqueEntries(definition.words
    .map(raw => resolveThemeEntry(raw, byWord))
    .filter((entry): entry is EnrichedWord => Boolean(entry)));
};

const buildFreeEntries = (): EnrichedWord[] => {
  const foundation = generalKidsFoundation().filter(entry => entry.level === 'A1' || entry.level === 'A2');
  const byWord = new Map(foundation.map(entry => [normalize(entry.word), entry]));
  const selected: EnrichedWord[] = [];
  const seen = new Set<string>();
  for (const candidate of [...FREE_KIDS_SEEDS, ...foundation.map(entry => entry.word)]) {
    const word = normalize(candidate);
    const entry = byWord.get(word);
    if (!entry || seen.has(word)) continue;
    seen.add(word);
    selected.push(entry);
    if (selected.length >= FREE_KIDS_TARGET) break;
  }
  return selected;
};

const matchesDifficulty = (entry: EnrichedWord, difficulty: DifficultyLevel): boolean =>
  difficulty === 'ALL' || entry.level === difficulty;

const withCounts = (item: KidsDictionaryDefinition): KidsDictionaryMeta => ({
  id: item.id,
  title: item.title,
  shortTitle: item.shortTitle,
  theme: item.theme,
  icon: item.icon,
  wordCount: item.words.length,
});

export const getFreeKidsDictionaryEntries = (difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] =>
  buildFreeEntries().filter(entry => matchesDifficulty(entry, difficulty));

export const getDefaultKidsDictionaryId = (): KidsDictionaryId => 'kids_animals';

export const getKidsDictionaryCatalog = (): KidsDictionaryMeta[] => themeDefinitions.map(withCounts);

export const getKidsDictionaryMeta = (id?: string): KidsDictionaryMeta | null =>
  id ? getKidsDictionaryCatalog().find(item => item.id === id) || null : null;

export const getKidsPremiumDictionaryEntries = (id?: string, difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] => {
  const dictionary = id ? dictionaries[id as KidsDictionaryId] : undefined;
  if (!dictionary) return [];
  return buildThemeEntries(dictionary).filter(entry => matchesDifficulty(entry, difficulty));
};

export const getKidsPremiumDictionaryWords = (id?: string, difficulty: DifficultyLevel = 'ALL'): string[] =>
  getKidsPremiumDictionaryEntries(id, difficulty).map(entry => entry.word);

export const getAllKidsDictionaryEntries = (): EnrichedWord[] => uniqueEntries([
  ...getFreeKidsDictionaryEntries(),
  ...themeDefinitions.flatMap(buildThemeEntries),
]);

export const getAllKidsDictionaryWords = (): string[] => getAllKidsDictionaryEntries().map(entry => entry.word);
