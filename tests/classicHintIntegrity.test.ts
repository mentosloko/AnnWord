import { describe, expect, it } from 'vitest';
import { createInitialGameState, getClassicTargetWordLength } from '../hooks/useClassicGameController';

describe('Classic round integrity', () => {
  it('uses the persisted secret length even when settings still say four letters', () => {
    const state = { ...createInitialGameState(), secretWord: 'CAMEL' };
    expect(getClassicTargetWordLength(state, 4)).toBe(5);
  });

  it('falls back to the configured length before a secret word exists', () => {
    expect(getClassicTargetWordLength(createInitialGameState(), 6)).toBe(6);
  });
});
