import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { useDictionaryPools } from '../hooks/useDictionaryPools';
import { GameSettings } from '../types';

const baseSettings: GameSettings = {
  username: 'Tester',
  wordLength: 6,
  difficulty: 'ALL',
  dictionarySource: 'custom',
  useCustomDictionary: true,
};

describe('useDictionaryPools', () => {
  it('keeps non-Wordle mode words independent from selected Wordle length by default', () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = renderHook(() => useDictionaryPools({ settings: baseSettings, userProfile }));

    expect(result.current.getModeWords()).toEqual(['CAT', 'TREE', 'PLANET', 'BUTTON']);
  });

  it('can still filter mode words by selected word length for Wordle-like needs', () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = renderHook(() => useDictionaryPools({ settings: baseSettings, userProfile }));

    expect(result.current.getModeWords({ respectWordLength: true })).toEqual(['PLANET', 'BUTTON']);
  });

  it('keeps builtin mini-game words aligned with builtin difficulty without word-length filtering by default', () => {
    const settings: GameSettings = {
      ...baseSettings,
      dictionarySource: 'builtin',
      useCustomDictionary: false,
      difficulty: 'A1',
      wordLength: 5,
    };

    const { result } = renderHook(() => useDictionaryPools({ settings, userProfile: GUEST_PROFILE }));
    const modeWords = result.current.getModeWords();

    expect(modeWords.length).toBeGreaterThan(0);
    expect(modeWords.some(word => word.length !== 5)).toBe(true);
    expect(result.current.getModeWords({ respectWordLength: true }).every(word => word.length === 5)).toBe(true);
  });
});