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
  it('filters mini-game mode words by selected word length', () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = renderHook(() => useDictionaryPools({ settings: baseSettings, userProfile }));

    expect(result.current.getModeWords()).toEqual(['PLANET', 'BUTTON']);
  });

  it('keeps mini-game mode words aligned with builtin difficulty and word length', () => {
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
    expect(modeWords.every(word => word.length === 5)).toBe(true);
  });
});
