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
  it('keeps supported non-Wordle mode words independent from selected Wordle length by default', () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = renderHook(() => useDictionaryPools({ settings: baseSettings, userProfile }));
    const words = result.current.getModeWords();

    expect(words).not.toContain('UNKNWN');
    expect(words.every(word => userProfile.customDictionaryEn.includes(word))).toBe(true);
  });

  it('can still filter mode words by selected word length for Wordle-like needs', () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = renderHook(() => useDictionaryPools({ settings: baseSettings, userProfile }));

    expect(result.current.getModeWords({ respectWordLength: true }).every(word => word.length === 6)).toBe(true);
  });

  it('excludes words absent from the general dictionary in mini-game and validation pools', () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['PLANET', 'UNKNWN'],
    };

    const { result } = renderHook(() => useDictionaryPools({ settings: baseSettings, userProfile }));

    expect(result.current.getModeWords()).not.toContain('UNKNWN');
    expect(result.current.getValidationPool()).not.toContain('UNKNWN');
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