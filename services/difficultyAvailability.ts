import type { DifficultyLevel, EnrichedWord } from '../types';
import { isAllowedSecretWord } from './dictionaryEngine';
import { hasRussianTranslation, normalizeWord } from './wordNormalization';

export const CEFR_LEVELS: Array<Exclude<DifficultyLevel, 'ALL'>> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['ALL', ...CEFR_LEVELS];
export const MIN_PLAYABLE_CEFR_WORDS = 3;

export type DifficultyAvailability = {
  level: DifficultyLevel;
  playableCount: number;
  available: boolean;
};

const isPlayableEntry = (entry: EnrichedWord): boolean => {
  const word = normalizeWord(entry.word);
  return Boolean(word) && hasRussianTranslation(entry.translation) && isAllowedSecretWord(word);
};

export const getPlayableEntriesForDifficulty = (
  entries: EnrichedWord[],
  difficulty: DifficultyLevel,
): EnrichedWord[] => entries.filter(entry =>
  isPlayableEntry(entry) && (difficulty === 'ALL' || entry.level === difficulty),
);

export const buildDifficultyAvailability = (
  entries: EnrichedWord[],
  minimumPlayableWords = MIN_PLAYABLE_CEFR_WORDS,
): DifficultyAvailability[] => DIFFICULTY_LEVELS.map(level => {
  const playableCount = getPlayableEntriesForDifficulty(entries, level).length;
  return {
    level,
    playableCount,
    available: playableCount >= minimumPlayableWords,
  };
});

export const difficultyUnavailableMessage = (level: DifficultyLevel, kidsMode: boolean): string => {
  if (kidsMode && level !== 'ALL') {
    return `Уровень ${level} пока недоступен: в детском словаре недостаточно слов с русским переводом для стабильной игры.`;
  }
  if (level === 'ALL') {
    return 'Общий словарь пока не содержит достаточно переведённых игровых слов.';
  }
  return `Уровень ${level} пока недоступен: недостаточно слов с русским переводом для стабильной игры.`;
};
