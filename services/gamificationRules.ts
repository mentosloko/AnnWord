import { CharacterMood, CharacterStage, PetState } from '../types';
import { ECONOMY_COIN_REWARDS as C } from './economyConfig';

interface RewardAdjustment {
  coinsAdjustment?: number;
  /**
   * Used by session-style modes that already granted per-word rewards but still
   * need to register one completed training in the global stats model.
   */
  statsOnly?: boolean;
  /** Optional explicit success flag for stats-only session completions. */
  wonForStats?: boolean;
}

export type GameRewardInput =
  | ({ type: 'wordle'; won: boolean; attempts?: number } & RewardAdjustment)
  | ({ type: 'sprint'; guessedWords: number } & RewardAdjustment)
  | ({ type: 'anagram'; guessedWords: number } & RewardAdjustment)
  | ({ type: 'translation'; guessedWords: number } & RewardAdjustment)
  | ({ type: 'memory'; clicks: number } & RewardAdjustment)
  | ({ type: 'hangman'; won: boolean; mistakes: number; maxMistakes: number } & RewardAdjustment)
  | ({ type: 'other' } & RewardAdjustment);

export interface GameRewardResult { xp: number; coins: number; mood: number; label: string; }
export interface CharacterProgressResult { pet: PetState; previousLevel: number; newLevel: number; previousStage: CharacterStage; newStage: CharacterStage; leveledUp: boolean; stagedUp: boolean; }

const T = [0, 120, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200, 6800, 8600];
const cl = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const st = (level: number): CharacterStage => level >= 10 ? 'stage_4' : level >= 7 ? 'stage_3' : level >= 4 ? 'stage_2' : 'stage_1';

export const getTotalXpForLevel = (level: number) => { const normalizedLevel = Math.max(1, Math.round(level || 1)); if (normalizedLevel <= T.length) return T[normalizedLevel - 1]; const extraLevels = normalizedLevel - T.length; return T[T.length - 1] + extraLevels * 2000 + extraLevels * (extraLevels - 1) * 150; };
export const CHARACTER_LEVEL_THRESHOLDS = Array.from({ length: 20 }, (_, index) => ({ level: index + 1, totalXp: getTotalXpForLevel(index + 1), stage: st(index + 1) }));
export const deriveCharacterLevel = (xp: number) => { let level = 1; while (level < 100 && Math.max(0, Math.round(xp || 0)) >= getTotalXpForLevel(level + 1)) level++; return level; };
export const deriveCharacterStage = (level: number) => st(level);
export const getCharacterStageLabel = (stage?: CharacterStage) => ({ stage_1: 'Малыш', stage_2: 'Юный исследователь', stage_3: 'Знаток слов', stage_4: 'Мастер слов' }[stage || 'stage_1']);
export const deriveMoodFromScore = (score: number): CharacterMood => { const value = cl(score); return value <= 20 ? 'sad' : value <= 45 ? 'calm' : value <= 70 ? 'happy' : value <= 90 ? 'joyful' : 'super_happy'; };
export const normalizeMoodScore = (pet: PetState) => typeof pet.moodScore === 'number' ? cl(pet.moodScore) : ({ sad: 15, neutral: 40, calm: 40, happy: 60, excited: 80, joyful: 80, super_happy: 95 }[pet.mood] || 50);
export const getNextLevelThreshold = (level: number) => getTotalXpForLevel(level + 1);
export const getCurrentLevelThreshold = (level: number) => getTotalXpForLevel(level);

export const calculateGameReward = (input: GameRewardInput): GameRewardResult => {
  if (input.statsOnly) return { xp: 0, coins: 0, mood: 0, label: 'Stats only' };
  const coinAdjustment = Math.round(input.coinsAdjustment || 0);
  const reward = (xp: number, coins: number, label: string): GameRewardResult => ({ xp, coins: coins + coinAdjustment, mood: 0, label });
  if (input.type === 'wordle') return input.won ? reward(25, C.wordle.win, 'Wordle win') : reward(8, C.wordle.loss, 'Wordle done');
  if (input.type === 'sprint') { const guessedWords = Math.max(0, Math.round(input.guessedWords || 0)); const xp = guessedWords ? Math.min(30, guessedWords * 5) : 5; return reward(xp, guessedWords >= 10 ? C.sprint.great : guessedWords >= 6 ? C.sprint.good : C.sprint.low, 'Sprint done'); }
  if (input.type === 'anagram') { const guessedWords = Math.max(0, Math.round(input.guessedWords || 0)); const xp = guessedWords ? Math.min(25, guessedWords * 5) : 5; return reward(xp, C.anagram.success, 'Anagram done'); }
  if (input.type === 'translation') { const guessedWords = Math.max(0, Math.round(input.guessedWords || 0)); const xp = guessedWords ? Math.min(30, guessedWords * 4) : 5; return reward(xp, guessedWords >= 9 ? C.sprint.good : guessedWords >= 6 ? C.sprint.low : 0, 'Translation choice done'); }
  if (input.type === 'memory') { const clicks = Math.max(0, Math.round(input.clicks || 0)); const xp = clicks > 0 && clicks <= 12 ? 30 : clicks <= 16 ? 25 : clicks <= 20 ? 20 : clicks <= 24 ? 15 : clicks > 24 ? 10 : 8; return reward(xp, clicks > 0 && clicks <= 16 ? C.memory.great : clicks <= 24 ? C.memory.good : C.memory.low, 'Memory done'); }
  if (input.type === 'hangman') { const maxMistakes = Math.max(1, Math.round(input.maxMistakes || 7)); const mistakes = Math.max(0, Math.min(maxMistakes, Math.round(input.mistakes || 0))); const xp = input.won ? 25 + Math.min(10, maxMistakes - mistakes) : 8; return reward(xp, input.won ? (mistakes <= 1 ? C.hangman.perfect : C.hangman.win) : C.hangman.loss, 'Hangman done'); }
  return reward(0, 0, 'Done');
};

export const applyGameRewardToCharacter = (pet: PetState, reward: GameRewardResult): CharacterProgressResult => { const previousLevel = deriveCharacterLevel(pet.xp || 0); const xp = Math.max(0, Math.round(pet.xp || 0)) + Math.max(0, Math.round(reward.xp || 0)); const newLevel = deriveCharacterLevel(xp); const moodScore = normalizeMoodScore(pet); const updatedPet = { ...pet, xp, level: newLevel, stage: st(newLevel), moodScore, mood: deriveMoodFromScore(moodScore) }; return { pet: updatedPet, previousLevel, newLevel, previousStage: st(previousLevel), newStage: st(newLevel), leveledUp: newLevel > previousLevel, stagedUp: st(newLevel) !== st(previousLevel) }; };
export const applyTreatMood = (pet: PetState, delta: number, _cap?: number): PetState => { const moodScore = Math.min(100, normalizeMoodScore(pet) + Math.max(0, Math.round(delta || 0))); return { ...pet, moodScore, mood: deriveMoodFromScore(moodScore) }; };
export const getCharacterProgressText = (pet: PetState) => `До следующего уровня: ${Math.max(0, getNextLevelThreshold(deriveCharacterLevel(pet.xp || 0)) - (pet.xp || 0))} очков опыта`;
export const getCharacterProgressPercent = (pet: PetState) => { const level = deriveCharacterLevel(pet.xp || 0), current = getCurrentLevelThreshold(level), next = getNextLevelThreshold(level); return next <= current ? 100 : cl(((pet.xp || 0) - current) / (next - current) * 100); };
