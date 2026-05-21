import { CharacterMood, CharacterStage, GameRewardType, PetState } from '../types';

export interface GameRewardInput {
  type: GameRewardType;
  won?: boolean;
  guessedWords?: number;
  clicks?: number;
  coinsAdjustment?: number;
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

const getStageForLevel = (level: number): CharacterStage => {
  if (level >= 15) return 'stage_4';
  if (level >= 9) return 'stage_3';
  if (level >= 3) return 'stage_2';
  return 'stage_1';
};

export const getTotalXpForLevel = (level: number): number => {
  const normalizedLevel = Math.max(1, Math.round(level || 1));
  if (normalizedLevel === 1) return 0;
  if (normalizedLevel === 2) return 50;
  if (normalizedLevel === 3) return 120;
  if (normalizedLevel === 4) return 220;
  if (normalizedLevel === 5) return 360;
  return 360 + (normalizedLevel - 5) * normalizedLevel * 180;
};

export const CHARACTER_LEVEL_THRESHOLDS = Array.from({ length: 20 }, (_, index) => {
  const level = index + 1;
  return {
    level,
    totalXp: getTotalXpForLevel(level),
    stage: getStageForLevel(level),
  };
});

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, Math.round(value)));
const normalizeCoinsAdjustment = (value?: number): number => Math.round(value || 0);

export const deriveCharacterLevel = (totalXp: number): number => {
  const normalizedXp = Math.max(0, Math.round(totalXp || 0));
  let level = 1;

  for (let candidate = 1; candidate <= 100; candidate += 1) {
    if (normalizedXp >= getTotalXpForLevel(candidate)) level = candidate;
    else break;
  }

  return level;
};

export const deriveCharacterStage = (level: number): CharacterStage => getStageForLevel(level);

export const getCharacterStageLabel = (stage: CharacterStage | undefined): string => {
  switch (stage) {
    case 'stage_2': return 'Юный исследователь';
    case 'stage_3': return 'Знаток слов';
    case 'stage_4': return 'Мастер слов';
    case 'stage_1':
    default:
      return 'Малыш';
  }
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

export const getNextLevelThreshold = (level: number): number | null => getTotalXpForLevel(level + 1);

export const getCurrentLevelThreshold = (level: number): number => getTotalXpForLevel(level);

const getPityXp = (won?: boolean): number => (won ? 0 : 8);

export const calculateGameReward = (input: GameRewardInput): GameRewardResult => {
  const coinsAdjustment = normalizeCoinsAdjustment(input.coinsAdjustment);

  switch (input.type) {
    case 'wordle': {
      const won = Boolean(input.won);
      const xp = won ? 25 : getPityXp(won);
      return {
        xp,
        coins: (won ? 3 : 1) + coinsAdjustment,
        mood: Math.min(12, xp),
        label: won ? 'Wordle угадан' : 'Wordle завершён',
      };
    }
    case 'sprint': {
      const guessed = Math.max(0, Math.round(input.guessedWords || 0));
      const xp = guessed > 0 ? Math.min(30, guessed * 5) : 5;
      return {
        xp,
        coins: (guessed >= 3 ? 2 : guessed >= 1 ? 1 : 0) + coinsAdjustment,
        mood: Math.min(12, xp),
        label: 'Спринт завершён',
      };
    }
    case 'anagram': {
      const guessed = Math.max(0, Math.round(input.guessedWords || 0));
      const xp = guessed > 0 ? Math.min(25, guessed * 5) : 5;
      return {
        xp,
        coins: (guessed >= 3 ? 2 : guessed >= 1 ? 1 : 0) + coinsAdjustment,
        mood: Math.min(10, xp),
        label: 'Анаграммы',
      };
    }
    case 'memory': {
      const clicks = Math.max(0, Math.round(input.clicks || 0));
      let xp = 8;
      if (clicks > 0 && clicks <= 12) xp = 30;
      else if (clicks <= 16) xp = 25;
      else if (clicks <= 20) xp = 20;
      else if (clicks <= 24) xp = 15;
      else if (clicks > 24) xp = 10;

      return {
        xp,
        coins: (clicks > 0 && clicks <= 16 ? 2 : clicks <= 24 ? 1 : 0) + coinsAdjustment,
        mood: Math.min(12, xp),
        label: 'Мемо завершено',
      };
    }
    case 'hangman': {
      const won = Boolean(input.won);
      const xp = won ? 25 : getPityXp(won);
      return {
        xp,
        coins: (won ? 2 : 1) + coinsAdjustment,
        mood: Math.min(12, xp),
        label: won ? 'Виселица пройдена' : 'Виселица завершена',
      };
    }
    default:
      return { xp: 0, coins: coinsAdjustment, mood: 0, label: 'Игра завершена' };
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

export const getCharacterProgressPercent = (pet: PetState): number => {
  const level = deriveCharacterLevel(pet.xp || 0);
  const currentThreshold = getCurrentLevelThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  if (nextThreshold === null || nextThreshold <= currentThreshold) return 100;
  return clamp(((pet.xp || 0) - currentThreshold) / (nextThreshold - currentThreshold) * 100);
};