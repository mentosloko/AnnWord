import { EnrichedWord } from '../types';
import { ALL_WORDS_EN as BASE_ALL_WORDS_EN, COMMON_WORDS_EN as BASE_COMMON_WORDS_EN } from './english';

export const ADDED_WORDS_EN: EnrichedWord[] = [
  { word: 'BURGER', translation: 'бургер', level: 'A1' },
  { word: 'CHIMP', translation: 'шимпанзе', level: 'A2' },
  { word: 'FRIDAY', translation: 'пятница', level: 'A1' },
  { word: 'KEBAB', translation: 'кебаб / шашлык', level: 'A2' },
  { word: 'MEOW', translation: 'мяу', level: 'A1' },
  { word: 'NANNY', translation: 'няня', level: 'A2' },
  { word: 'PIZZA', translation: 'пицца', level: 'A1' },
  { word: 'SUNDAY', translation: 'воскресенье', level: 'A1' },
  { word: 'TEDDY', translation: 'плюшевый мишка', level: 'A1' },
  { word: 'TOYS', translation: 'игрушки', level: 'A1' },
  { word: 'TSHIRT', translation: 'футболка', level: 'A1' },
  { word: 'WOOF', translation: 'гав-гав', level: 'A1' },
  { word: 'YUMMY', translation: 'вкусный', level: 'A1' },
];

export const COMMON_WORDS_EN: EnrichedWord[] = [...BASE_COMMON_WORDS_EN, ...ADDED_WORDS_EN]
  .sort((first, second) => first.word.localeCompare(second.word, 'en'));

export const ALL_WORDS_EN: string[] = Array.from(new Set([
  ...BASE_ALL_WORDS_EN,
  ...ADDED_WORDS_EN.map(entry => entry.word),
])).sort((first, second) => first.localeCompare(second, 'en'));
