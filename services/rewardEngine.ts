import { getIslandByDifficulty } from './islandProgressEngine';
import { canHatchEgg } from './petProgressionEngine';
import { getReactionForEvent } from './petReactionEngine';
import { GameEvent, PetProgressState, ProgressionEvent, RewardOutcome } from './worldTypes';

export interface RewardContext {
  petProgress?: PetProgressState;
  islandGuessedWords?: number;
}

export const getWordXp = (wordLength: number): number => {
  if (wordLength >= 6) return 18;
  if (wordLength === 5) return 12;
  return 8;
};

export const getWordCoins = (wordLength: number): number => {
  if (wordLength >= 6) return 8;
  if (wordLength === 5) return 5;
  return 3;
};

export const getProgressionEventForWord = (event: Extract<GameEvent, { type: 'WORD_GUESSED' }>, context: RewardContext = {}): ProgressionEvent | undefined => {
  if (context.petProgress && canHatchEgg({
    ...context.petProgress,
    guessedWordsSinceRegistration: context.petProgress.guessedWordsSinceRegistration + 1,
  })) {
    return { type: 'EGG_READY_TO_HATCH' };
  }

  const island = getIslandByDifficulty(event.difficulty);
  if (island && typeof context.islandGuessedWords === 'number') {
    const nextCount = context.islandGuessedWords + 1;
    if (nextCount >= island.wordsRequiredForSticker) {
      return { type: 'STICKER_UNLOCKED', islandId: island.id, stickerId: island.stickerId };
    }
  }

  return undefined;
};

export const getRewardForEvent = (
  event: GameEvent,
  context: RewardContext = {},
  random: () => number = Math.random,
): RewardOutcome => {
  if (event.type === 'WORD_GUESSED') {
    return {
      coinsDelta: getWordCoins(event.wordLength),
      xpDelta: getWordXp(event.wordLength),
      petReaction: getReactionForEvent(event, random),
      progressionEvent: getProgressionEventForWord(event, context),
    };
  }

  if (event.type === 'GAME_WON') {
    return {
      coinsDelta: 20,
      xpDelta: 50,
      petReaction: getReactionForEvent(event, random),
    };
  }

  if (event.type === 'PET_TAPPED') {
    return {
      coinsDelta: 0,
      xpDelta: 0,
      petReaction: getReactionForEvent(event, random),
    };
  }

  return { coinsDelta: 0, xpDelta: 0 };
};
