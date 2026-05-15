import { describe, expect, it } from 'vitest';
import { getRewardForEvent, getWordCoins, getWordXp } from '../services/rewardEngine';
import { PetProgressState } from '../services/worldTypes';

const eggProgress = (guessedWordsSinceRegistration: number): PetProgressState => ({
  kind: 'egg',
  level: 1,
  guessedWordsSinceRegistration,
  hatched: false,
});

describe('rewardEngine', () => {
  it('scales word rewards by word length', () => {
    expect(getWordXp(4)).toBe(8);
    expect(getWordXp(5)).toBe(12);
    expect(getWordXp(6)).toBe(18);
    expect(getWordCoins(4)).toBe(3);
    expect(getWordCoins(5)).toBe(5);
    expect(getWordCoins(6)).toBe(8);
  });

  it('returns reward and reaction for guessed words', () => {
    expect(getRewardForEvent({ type: 'WORD_GUESSED', word: 'APPLE', wordLength: 5, mode: 'classic' })).toMatchObject({
      coinsDelta: 5,
      xpDelta: 12,
      petReaction: { type: 'heart', intensity: 'medium' },
    });
  });

  it('emits egg-ready progression when next guessed word reaches hatch threshold', () => {
    const outcome = getRewardForEvent(
      { type: 'WORD_GUESSED', word: 'APPLE', wordLength: 5, mode: 'classic' },
      { petProgress: eggProgress(4) },
    );

    expect(outcome.progressionEvent).toEqual({ type: 'EGG_READY_TO_HATCH' });
  });

  it('emits sticker unlock progression when island threshold is reached', () => {
    const outcome = getRewardForEvent(
      { type: 'WORD_GUESSED', word: 'APPLE', wordLength: 5, mode: 'classic', difficulty: 'A1' },
      { islandGuessedWords: 9 },
    );

    expect(outcome.progressionEvent).toEqual({
      type: 'STICKER_UNLOCKED',
      islandId: 'forest_a1',
      stickerId: 'forest_a1_sticker',
    });
  });

  it('returns fixed win reward and tap phrase reward without currency', () => {
    expect(getRewardForEvent({ type: 'GAME_WON', mode: 'classic' })).toMatchObject({
      coinsDelta: 20,
      xpDelta: 50,
      petReaction: { type: 'sound', soundId: 'win' },
    });

    expect(getRewardForEvent({ type: 'PET_TAPPED' }, {}, () => 0)).toEqual({
      coinsDelta: 0,
      xpDelta: 0,
      petReaction: { type: 'phrase', text: 'I love learning!' },
    });
  });

  it('returns neutral reward for non-rewarding events', () => {
    expect(getRewardForEvent({ type: 'ITEM_PURCHASED', itemId: 'hat' })).toEqual({ coinsDelta: 0, xpDelta: 0 });
    expect(getRewardForEvent({ type: 'GAME_LOST', mode: 'classic' })).toEqual({ coinsDelta: 0, xpDelta: 0 });
  });
});
