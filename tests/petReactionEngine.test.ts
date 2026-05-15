import { describe, expect, it } from 'vitest';
import { getPetTapReaction, getReactionForEvent, getWordGuessedReaction, pickPetTapPhrase } from '../services/petReactionEngine';

describe('petReactionEngine', () => {
  it('picks tap phrases deterministically', () => {
    expect(pickPetTapPhrase(() => 0)).toBe('I love learning!');
    expect(pickPetTapPhrase(() => 0.99)).toBe('More words, please!');
  });

  it('maps word length to heart intensity', () => {
    expect(getWordGuessedReaction(4)).toEqual({ type: 'heart', intensity: 'small' });
    expect(getWordGuessedReaction(5)).toEqual({ type: 'heart', intensity: 'medium' });
    expect(getWordGuessedReaction(6)).toEqual({ type: 'heart', intensity: 'big' });
  });

  it('returns phrase reaction for pet tap', () => {
    expect(getPetTapReaction(() => 0.25)).toEqual({ type: 'phrase', text: 'You are a star!' });
  });

  it('resolves reactions from game events', () => {
    expect(getReactionForEvent({ type: 'WORD_GUESSED', word: 'PLANET', wordLength: 6, mode: 'classic' })).toEqual({ type: 'heart', intensity: 'big' });
    expect(getReactionForEvent({ type: 'PET_TAPPED' }, () => 0)).toEqual({ type: 'phrase', text: 'I love learning!' });
    expect(getReactionForEvent({ type: 'GAME_WON', mode: 'classic' })).toEqual({ type: 'sound', soundId: 'win' });
    expect(getReactionForEvent({ type: 'GAME_LOST', mode: 'classic' })).toBeUndefined();
  });
});
