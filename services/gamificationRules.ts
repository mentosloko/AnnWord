import { CharacterMood, CharacterStage, GameRewardType, PetState } from '../types';

export interface GameRewardInput {
  type: GameRewardType;
  won?: boolean;
  guessedWords?: number;
  clicks?: number;
}

export interface GameRewardResult {
  xp: number;
  coins: number;
  mood: number;
  label: string;
}

export interface CharacterProgressResult {
  pet: PetState;
  previousLevel: number;
  newLevel: number;
  previousStage: CharacterStage;
  newStage: CharacterStage;
  leveledUp: boolean;
  stagedUp: boolean;
}

export const CHARACTER_LEVEL_THRESHOLDS = [
  { level: 1, totalXp: 0, stage: 'stage_1' as const },
  { level: 2, totalXp: 10, stage: 'stage_1' as const },
  { level: 3, totalXp: 25, stage: 'stage_2' as const },
  { level: 4, totalXp: 45, stage: 'stage_2' as const },
  { level: 5, totalXp: 70, stage: 'stage_2' as const },
  { level: 6, totalXp: 100, stage: 'stage_3' as const },
  { level: 7, totalXp: 135, stage: 'stage_3' as const },
  { level: 8, totalXp: 175, stage: 'stage_3' as const },
  { level: 9, totalXp: 220, stage: 'stage_4' as const },
  { level: 10, totalXp: 270, stage: 'stage_4' as const },
];

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, Math.round(value)));

export const deriveCharacterLevel = (totalXp: number): number => {
  const normalizedXp = Math.max(0, Math.round(totalXp || 0));
  return CHARACTER_LEVEL_THRESHOLDS.reduce((level, threshold) => (
    normalizedXp >= threshold.totalXp ? threshold.level : level
  ), 1);
};

export const deriveCharacterStage = (level: number): CharacterStage => {
  const threshold = [...CHARACTER_LEVEL_THRESHOLDS]
    .reverse()
    .find(entry => level >= entry.level);
  return threshold?.stage || 'stage_1';
};

export const deriveMoodFromScore = (moodScore: number): CharacterMood => {
  const score = clamp(moodScore);
  if (score <= 20) return 'sad';
  if (score <= 45) return 'calm';
  if (score <= 70) return 'happy';
  if (score <= 90) return 'joyful';
  return 'super_happy';
};

export const normalizeMoodScore = (pet: PetState): number => {
  if (typeof pet.moodScore === 'number') return clamp(pet.moodScore);

  switch (pet.mood) {
    case 'sad': return 15;
    case 'neutral':
    case 'calm': return 40;
    case 'happy': return 60;
    case 'excited':
    case 'joyful': return 80;
    case 'super_happy': return 95;
    default: return 50;
  }
};

export const getNextLevelThreshold = (level: number): number | null => {
  const next = CHARACTER_LEVEL_THRESHOLDS.find(entry => entry.level === level + 1);
  return next?.totalXp ?? null;
};

export const getCurrentLevelThreshold = (level: number): number =>
  [...CHARACTER_LEVEL_THRESHOLDS]
    .reverse()
    .find(entry => level >= entry.level)?.totalXp ?? 0;

export const calculateGameReward = (input: GameRewardInput): GameRewardResult => {
  switch (input.type) {
    case 'wordle': {
      const won = Boolean(input.won);
      const xp = won ? 5 : 0;
      return {
        xp,
        coins: won ? 3 : 1,
        mood: xp,
        label: won ? 'Wordle угадан' : 'Wordle завершён',
      };
    }
    case 'sprint': {
      const guessed = Math.max(0, Math.round(input.guessedWords || 0));
      const xp = Math.min(4, guessed);
      return {
        xp,
        coins: guessed >= 3 ? 2 : guessed >= 1 ? 1 : 0,
        mood: xp,
        label: 'Спринт завершён',
      };
    }
    case 'anagram': {
      const guessed = Math.max(0, Math.round(input.guessedWords || 0));
      const xp = Math.min(4, guessed);
      return {
        xp,
        coins: guessed >= 3 ? 2 : guessed >= 1 ? 1 : 0,
        mood: xp,
        label: 'Анаграммы',
      };
    }
    case 'memory': {
      const clicks = Math.max(0, Math.round(input.clicks || 0));
      const xp = clicks > 0 && clicks <= 8 ? 4 : clicks <= 10 ? 3 : clicks <= 12 ? 2 : clicks <= 14 ? 1 : 0;
      return {
        xp,
        coins: clicks > 0 && clicks <= 12 ? 2 : clicks <= 14 ? 1 : 0,
        mood: xp,
        label: 'Мемо завершено',
      };
    }
    case 'hangman': {
      const won = Boolean(input.won);
      const xp = won ? 4 : 0;
      return {
        xp,
        coins: won ? 2 : 1,
        mood: xp,
        label: won ? 'Виселица пройдена' : 'Виселица завершена',
      };
    }
    default:
      return { xp: 0, coins: 0, mood: 0, label: 'Игра завершена' };
  }
};

export const applyGameRewardToCharacter = (pet: PetState, reward: Pick<GameRewardResult, 'xp' | 'mood'>): CharacterProgressResult => {
  const currentTotalXp = Math.max(0, Math.round(pet.xp || 0));
  const previousLevel = deriveCharacterLevel(currentTotalXp);
  const previousStage = deriveCharacterStage(previousLevel);
  const nextTotalXp = currentTotalXp + Math.max(0, Math.round(reward.xp || 0));
  const newLevel = deriveCharacterLevel(nextTotalXp);
  const newStage = deriveCharacterStage(newLevel);
  const moodScore = Math.min(70, normalizeMoodScore(pet) + Math.max(0, Math.round(reward.mood || 0)));

  const nextPet: PetState = {
    ...pet,
    xp: nextTotalXp,
    level: newLevel,
    stage: newStage,
    moodScore,
    mood: deriveMoodFromScore(moodScore),
  };

  return {
    pet: nextPet,
    previousLevel,
    newLevel,
    previousStage,
    newStage,
    leveledUp: newLevel > previousLevel,
    stagedUp: newStage !== previousStage,
  };
};

export const applyTreatMood = (pet: PetState, moodDelta: number, moodCap = 100): PetState => {
  const moodScore = Math.min(clamp(moodCap), normalizeMoodScore(pet) + Math.max(0, Math.round(moodDelta || 0)));
  return {
    ...pet,
    moodScore,
    mood: deriveMoodFromScore(moodScore),
  };
};

export const getCharacterProgressText = (pet: PetState): string => {
  const level = deriveCharacterLevel(pet.xp || 0);
  const nextThreshold = getNextLevelThreshold(level);
  if (nextThreshold === null) return 'Максимальный уровень';
  return `До следующего уровня: ${Math.max(0, nextThreshold - (pet.xp || 0))} XP`;
};
