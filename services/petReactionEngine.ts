import { PET_TAP_PHRASES } from './worldCatalog';
import { GameEvent, PetReaction } from './worldTypes';

const clampRandomIndex = (length: number, random: () => number): number =>
  Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * length));

export const pickPetTapPhrase = (random: () => number = Math.random): string =>
  PET_TAP_PHRASES[clampRandomIndex(PET_TAP_PHRASES.length, random)];

export const getWordGuessedReaction = (wordLength: number): PetReaction => ({
  type: 'heart',
  intensity: wordLength >= 6 ? 'big' : wordLength >= 5 ? 'medium' : 'small',
});

export const getPetTapReaction = (random: () => number = Math.random): PetReaction => ({
  type: 'phrase',
  text: pickPetTapPhrase(random),
});

export const getReactionForEvent = (event: GameEvent, random: () => number = Math.random): PetReaction | undefined => {
  if (event.type === 'WORD_GUESSED') return getWordGuessedReaction(event.wordLength);
  if (event.type === 'PET_TAPPED') return getPetTapReaction(random);
  if (event.type === 'GAME_WON') return { type: 'sound', soundId: 'win' };
  return undefined;
};
