import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { useDictionaryPools } from '../hooks/useDictionaryPools';
import { isAllowedSecretWord } from '../services/dictionaryEngine';
import { resetDictionaryRuntimeForTests } from '../services/dictionaryRuntime';
import { ensureSpotlightDictionaryLoaded, getSpotlightEntries, getSpotlightGrades, getSpotlightSections, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from '../services/spotlightDictionary';
import { GameSettings, UserProfile } from '../types';

const baseSettings: GameSettings = {
  username: 'Tester',
  wordLength: 6,
  difficulty: 'ALL',
  dictionarySource: 'custom',
  useCustomDictionary: true,
};

const renderLoadedPools = async (settings: GameSettings, userProfile: UserProfile = GUEST_PROFILE) => {
  const rendered = renderHook(() => useDictionaryPools({ settings, userProfile, enabled: true }));
  await waitFor(() => expect(rendered.result.current.status).toBe('ready'));
  return rendered;
};

const premiumProfile = (): UserProfile => ({
  ...GUEST_PROFILE,
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  featureFlags: { ...(GUEST_PROFILE.featureFlags || {}), premiumDictionaries: true },
});

const findGradeWithSections = (minimum: number) => {
  for (const grade of getSpotlightGrades()) {
    const sections = getSpotlightSections(grade).filter(section => section.wordCount > 0);
    if (sections.length >= minimum) return { grade, sections };
  }
  throw new Error(`Spotlight fixture needs at least ${minimum} populated sections in one grade.`);
};

describe('useDictionaryPools', () => {
  beforeEach(() => resetDictionaryRuntimeForTests());

  it('keeps supported non-Wordle mode words independent from selected Wordle length by default', async () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = await renderLoadedPools(baseSettings, userProfile);
    const words = result.current.getModeWords();

    expect(words).not.toContain('UNKNWN');
    expect(words.every(word => userProfile.customDictionaryEn.includes(word))).toBe(true);
  });

  it('can still filter mode words by selected word length for Wordle-like needs', async () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['CAT', 'TREE', 'PLANET', 'BUTTON'],
    };

    const { result } = await renderLoadedPools(baseSettings, userProfile);

    expect(result.current.getModeWords({ respectWordLength: true }).every(word => word.length === 6)).toBe(true);
  });

  it('excludes words absent from the general dictionary in mini-game and validation pools', async () => {
    const userProfile = {
      ...GUEST_PROFILE,
      customDictionaryEn: ['PLANET', 'UNKNWN'],
    };

    const { result } = await renderLoadedPools(baseSettings, userProfile);

    expect(result.current.getModeWords()).not.toContain('UNKNWN');
    expect(result.current.getValidationPool()).not.toContain('UNKNWN');
  });

  it('keeps builtin mini-game words aligned with builtin difficulty without word-length filtering by default', async () => {
    const settings: GameSettings = {
      ...baseSettings,
      dictionarySource: 'builtin',
      useCustomDictionary: false,
      difficulty: 'A1',
      wordLength: 5,
    };

    const { result } = await renderLoadedPools(settings);
    const words = result.current.getModeWords();

    expect(words.length).toBeGreaterThan(0);
    expect(words.some(word => word.length !== 5)).toBe(true);
    expect(result.current.getModeWords({ respectWordLength: true }).every(word => word.length === 5)).toBe(true);
  });

  it('uses the deduplicated union of all selected Spotlight modules in every mode pool', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const sectionIds = sections.slice(0, 2).map(section => section.id);
    const expectedEntries = getSpotlightEntries(grade, sectionIds).filter(entry => isAllowedSecretWord(entry.word));
    expect(expectedEntries.length).toBeGreaterThan(0);
    const settings: GameSettings = {
      ...baseSettings,
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionId: sectionIds[0],
      activeSpotlightSectionIds: sectionIds,
    };

    const { result } = await renderLoadedPools(settings, premiumProfile());
    const modeWords = result.current.getModeWords();

    expect(new Set(modeWords)).toEqual(new Set(expectedEntries.map(entry => entry.word)));
    expect(modeWords.length).toBe(new Set(modeWords).size);
    const translated = expectedEntries.find(entry => Boolean(entry.translation));
    expect(translated).toBeTruthy();
    expect(result.current.getWordTranslation(translated!.word)).toBe(translated!.translation);
  });

  it('keeps Wordle length filtering on top of a multi-module Spotlight union', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const sectionIds = sections.slice(0, 2).map(section => section.id);
    const settings: GameSettings = {
      ...baseSettings,
      dictionarySource: 'premium',
      useCustomDictionary: false,
      wordLength: 5,
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionIds: sectionIds,
    };

    const { result } = await renderLoadedPools(settings, premiumProfile());
    const allModeWords = result.current.getModeWords();
    const wordleWords = result.current.getModeWords({ respectWordLength: true });

    expect(wordleWords.every(word => word.length === 5)).toBe(true);
    expect(wordleWords.every(word => allModeWords.includes(word))).toBe(true);
  });
});
