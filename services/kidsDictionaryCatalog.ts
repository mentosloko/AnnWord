import type { DifficultyLevel, EnrichedWord } from '../types';
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

type KidsDictionaryDefinition = Omit<KidsDictionaryMeta, 'wordCount' | 'levelCounts'> & { seeds: string[] };

const MIN_THEME_WORDS = 150;

const FREE_KIDS_SEEDS = [
  'APPLE','BABY','BALL','BEAR','BIRD','BOOK','CAKE','CAT','CHAIR','CLOUD','DOG','DOOR','DUCK','FISH','GAME','GIRL','HAPPY','HOUSE','JUICE','MILK','MOON','MOUSE','PANDA','PIZZA','ROBOT','SCHOOL','SMILE','STAR','SUN','TABLE','TEDDY','TRAIN','TREE','WATER','YUMMY',
  'AIRPLANE','ANT','ARM','BAG','BANANA','BATH','BED','BEE','BICYCLE','BLUE','BOAT','BREAD','BROTHER','BUS','BUTTER','CAR','CARROT','CHEESE','CHICKEN','CHILD','CLASS','CLOCK','COAT','COLOR','COOKIE','COW','DANCE','DAY','DOLL','DRESS','EAR','EGG','ELEPHANT','EYE','FACE','FAMILY','FARM','FATHER','FLOWER','FOOT','FROG','FRIEND','FROST','GARDEN','GOAT','GREEN','HAND','HAT','HEAD','HEART','HORSE','ICE','JACKET','KITCHEN','KITE','LAMP','LEMON','LION','MANGO','MOTHER','MUSIC','NIGHT','NOSE','ORANGE','PAPER','PARK','PENCIL','PEN','PIG','PLANE','PLAY','RAIN','RED','RIVER','ROOM','SAND','SHEEP','SHOE','SISTER','SKY','SNOW','SONG','SPOON','STREET','SWIM','TEACHER','TIGER','TOY','UMBRELLA','VILLAGE','WALL','WATCH','WEATHER','WINDOW','WIND','WRITE','YELLOW','ZEBRA',
];

const dictionaries: Record<KidsDictionaryId, KidsDictionaryDefinition> = {
  kids_animals: { id:'kids_animals', title:'Животные', shortTitle:'Животные', theme:'animals', icon:'🐾', seeds:[
    'ANT','BAT','BEAR','BEE','BIRD','BUTTERFLY','CAMEL','CAT','CHICK','CHICKEN','COW','CROCODILE','DEER','DOG','DOLPHIN','DONKEY','DUCK','EAGLE','ELEPHANT','FISH','FLY','FOX','FROG','GIRAFFE','GOAT','HAMSTER','HEN','HIPPO','HORSE','KANGAROO','KOALA','LAMB','LION','LIZARD','MONKEY','MOUSE','OWL','PANDA','PARROT','PEACOCK','PENGUIN','PIG','PUPPY','RABBIT','SHEEP','SNAKE','SPIDER','SQUIRREL','TIGER','TURTLE','WHALE','WOLF','ZEBRA'
  ]},
  kids_food: { id:'kids_food', title:'Еда и напитки', shortTitle:'Еда', theme:'food', icon:'🍎', seeds:[
    'APPLE','BANANA','BERRY','BREAD','BURGER','BUTTER','CAKE','CANDY','CARROT','CHEESE','CHICKEN','CHOCOLATE','COOKIE','CORN','CREAM','CUCUMBER','EGG','FISH','FRUIT','GRAPE','HONEY','ICE','ICECREAM','JUICE','LEMON','LUNCH','MANGO','MEAT','MILK','NOODLE','ORANGE','PANCAKE','PEAR','PIZZA','POTATO','RICE','SALAD','SANDWICH','SAUSAGE','SOUP','SUGAR','TEA','TOMATO','WATER','YOGURT'
  ]},
  kids_home: { id:'kids_home', title:'Дом и быт', shortTitle:'Дом', theme:'home', icon:'🏠', seeds:[
    'BATH','BATHROOM','BED','BEDROOM','BLANKET','BOOKSHELF','BOTTLE','BOWL','CARPET','CHAIR','CLOCK','CUP','CURTAIN','DOOR','DRAWER','FLOOR','FRIDGE','GARDEN','GLASS','HALL','HOME','HOUSE','KITCHEN','LAMP','LIVINGROOM','MIRROR','PILLOW','PLATE','ROOM','ROOF','SHELF','SHOWER','SOFA','SPOON','STAIRS','TABLE','TOILET','TOWEL','WALL','WARDROBE','WINDOW'
  ]},
  kids_school: { id:'kids_school', title:'Школа и день', shortTitle:'Школа', theme:'school', icon:'🎒', seeds:[
    'ANSWER','BACKPACK','BOARD','BOOK','BREAK','CLASS','CLASSROOM','COLOR','COUNT','DESK','DRAW','ENGLISH','ERASER','EXERCISE','HOMEWORK','LEARN','LESSON','LETTER','LINE','MAP','MARKER','MUSIC','NOTE','NUMBER','PAGE','PAINT','PAPER','PENCIL','PEN','QUESTION','READ','RULER','SCHOOL','SPELL','STUDENT','TEACH','TEACHER','TEST','TEXT','TITLE','WORD','WRITE'
  ]},
  kids_family_friends: { id:'kids_family_friends', title:'Семья и друзья', shortTitle:'Семья', theme:'family', icon:'👨‍👩‍👧‍👦', seeds:[
    'AUNT','BABY','BOY','BROTHER','CHILD','COUSIN','DAD','DAUGHTER','FAMILY','FATHER','FRIEND','GIRL','GRANDMA','GRANDFATHER','GRANDMOTHER','GRANDPA','KID','MAN','MOTHER','MUM','PARENT','SISTER','SON','UNCLE','WOMAN','YOUNG','OLDER','SMILE','HELP','SHARE','TALK','VISIT','LOVE','HAPPY','KIND'
  ]},
  kids_nature_weather: { id:'kids_nature_weather', title:'Природа и погода', shortTitle:'Природа', theme:'nature', icon:'🌦️', seeds:[
    'AIR','AUTUMN','BEACH','CLOUD','COLD','EARTH','FIRE','FLOWER','FOREST','FROST','GARDEN','GRASS','HILL','HOT','ICE','ISLAND','LAKE','LEAF','LIGHTNING','MOON','MOUNTAIN','NATURE','OCEAN','PLANT','RAIN','RAINBOW','RIVER','ROCK','SAND','SEA','SKY','SNOW','SPRING','STAR','STORM','SUN','SUMMER','TREE','WARM','WATER','WEATHER','WIND','WINTER'
  ]},
  kids_transport_travel: { id:'kids_transport_travel', title:'Транспорт и путешествия', shortTitle:'Транспорт', theme:'transport', icon:'🚆', seeds:[
    'AIRPLANE','AIRPORT','BAG','BICYCLE','BOAT','BRIDGE','BUS','BUSSTOP','CAR','DRIVER','FLIGHT','HELICOPTER','HOTEL','JOURNEY','MAP','METRO','MOTORBIKE','MOUNTAIN','PASSENGER','PLANE','ROAD','ROCKET','SHIP','STATION','STREET','SUBWAY','SUITCASE','TAXI','TICKET','TRAIN','TRAVEL','TRIP','TRUCK','WALK','WHEEL'
  ]},
  kids_games_hobbies: { id:'kids_games_hobbies', title:'Игры и хобби', shortTitle:'Хобби', theme:'hobbies', icon:'🎨', seeds:[
    'BALL','BOARDGAME','BOOK','CAMERA','CHESS','CLAY','COLOR','COMIC','DANCE','DRAW','DRUM','FILM','GAME','GUITAR','KITE','MUSIC','PAINT','PHOTO','PIANO','PLAY','PUZZLE','READ','ROBOT','RUN','SING','SKATE','SPORT','SWIM','TOY','VIDEO','WRITE'
  ]},
};

const normalize = (word: string): string => word.trim().toUpperCase().replace(/[^A-Z]/g, '');

const generalKidsFoundation = (): EnrichedWord[] => getKidsCefrEntries(
  readGeneralDictionary()?.COMMON_WORDS_EN || [],
).filter(entry => entry.level === 'A1' || entry.level === 'A2');

const buildEntries = (seeds: string[], minimum = MIN_THEME_WORDS): EnrichedWord[] => {
  const byWord = new Map(generalKidsFoundation().map(entry => [normalize(entry.word), entry]));
  const selected: EnrichedWord[] = [];
  const seen = new Set<string>();
  for (const candidate of [...seeds, ...generalKidsFoundation().map(entry => entry.word)]) {
    const word = normalize(candidate);
    const entry = byWord.get(word);
    if (!entry || seen.has(word)) continue;
    seen.add(word);
    selected.push(entry);
    if (selected.length >= minimum) break;
  }
  return selected;
};

const matchesDifficulty = (entry: EnrichedWord, difficulty: DifficultyLevel): boolean =>
  difficulty === 'ALL' || entry.level === difficulty;

const withCounts = (item: KidsDictionaryDefinition): KidsDictionaryMeta => ({
  id: item.id, title: item.title, shortTitle: item.shortTitle, theme: item.theme, icon: item.icon, wordCount: MIN_THEME_WORDS,
});

export const getFreeKidsDictionaryEntries = (difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] =>
  buildEntries(FREE_KIDS_SEEDS).filter(entry => matchesDifficulty(entry, difficulty));

export const getDefaultKidsDictionaryId = (): KidsDictionaryId => 'kids_animals';

export const getKidsDictionaryCatalog = (): KidsDictionaryMeta[] => Object.values(dictionaries).map(withCounts);

export const getKidsDictionaryMeta = (id?: string): KidsDictionaryMeta =>
  getKidsDictionaryCatalog().find(item => item.id === id) || getKidsDictionaryCatalog()[0];

export const getKidsPremiumDictionaryEntries = (id?: string, difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] => {
  const dictionaryId = dictionaries[id as KidsDictionaryId] ? id as KidsDictionaryId : getDefaultKidsDictionaryId();
  return buildEntries(dictionaries[dictionaryId].seeds).filter(entry => matchesDifficulty(entry, difficulty));
};

export const getKidsPremiumDictionaryWords = (id?: string, difficulty: DifficultyLevel = 'ALL'): string[] =>
  getKidsPremiumDictionaryEntries(id, difficulty).map(entry => entry.word);

export const getAllKidsDictionaryEntries = (): EnrichedWord[] => {
  const seen = new Set<string>();
  const entries: EnrichedWord[] = [
    ...getFreeKidsDictionaryEntries(),
    ...Object.values(dictionaries).flatMap<EnrichedWord>(item => buildEntries(item.seeds)),
  ];
  return entries.filter(entry => !seen.has(entry.word) && seen.add(entry.word));
};

export const getAllKidsDictionaryWords = (): string[] => getAllKidsDictionaryEntries().map(entry => entry.word);
