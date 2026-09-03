import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { resolveActiveDictionaryDescriptor } from '../services/activeDictionaryDescriptor';
import { ensureGeneralDictionaryLoaded, resolvePremiumDictionaryId } from '../services/dictionaryRuntime';
import { getKidsDictionaryCatalog, getKidsDictionaryMeta, getKidsPremiumDictionaryEntries } from '../services/kidsDictionaryCatalog';
import { ensureSpotlightDictionaryLoaded, getSpotlightEntries, getSpotlightSections, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from '../services/spotlightDictionary';
import type { GameSettings, UserProfile } from '../types';

const parentProfile = {
  ...GUEST_PROFILE,
  role: 'parent',
  accountMode: 'parent',
  assignedWords: [],
} as UserProfile;

const baseSettings: GameSettings = {
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Parent',
};

beforeAll(async () => {
  await ensureGeneralDictionaryLoaded();
  await ensureSpotlightDictionaryLoaded();
});

describe('active dictionary source integrity', () => {
  it('describes Spotlight as Spotlight in Kids mode instead of falling back to Animals', () => {
    const descriptor = resolveActiveDictionaryDescriptor({
      ...baseSettings,
      dictionarySource: 'premium',
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: 3,
      activeSpotlightSectionId: 'module-1',
    }, parentProfile, true);

    expect(descriptor.title).toContain('Spotlight');
    expect(descriptor.title).toContain('3 класс');
    expect(descriptor.title).not.toContain('Животные');
    expect(getKidsDictionaryMeta(SPOTLIGHT_PREMIUM_DICTIONARY_ID)).toBeNull();
  });

  it('does not replace unknown premium or Kids theme ids with another dictionary', () => {
    expect(resolvePremiumDictionaryId('premium_missing')).toBeNull();
    expect(getKidsDictionaryMeta('kids_missing')).toBeNull();
    expect(getKidsPremiumDictionaryEntries('kids_missing')).toEqual([]);
  });

  it('does not replace an unknown Spotlight section with the whole grade', () => {
    const sections = getSpotlightSections(3);
    expect(sections.length).toBeGreaterThan(0);
    expect(getSpotlightEntries(3, 'missing-section')).toEqual([]);
  });

  it('keeps every Kids theme limited to its curated file instead of padding from CEFR', () => {
    for (const dictionary of getKidsDictionaryCatalog()) {
      const words = getKidsPremiumDictionaryEntries(dictionary.id).map(entry => entry.word);
      expect(words.length).toBeGreaterThan(0);
      expect(words).not.toEqual(expect.arrayContaining(['ABLE', 'ACTS', 'ADDS', 'ALSO']));
    }
  });

  it('keeps ordinary game tiles separate from the explicit saved-game resume path', () => {
    const source = readFileSync('components/AppScreens.tsx', 'utf8');
    const resume = source.slice(source.indexOf('const resumeSavedGame'), source.indexOf('const requestQuickLaunch'));
    const quickLaunch = source.slice(source.indexOf('const requestQuickLaunch'), source.indexOf('const startSelectedMode'));
    const start = source.slice(source.indexOf('const startSelectedMode'), source.indexOf('const startDailyQuest'));

    expect(quickLaunch).not.toContain('resumeSavedGame()');
    expect(resume).toContain('setResumeSavedType(saved.gameType)');
    expect(resume).toContain("onRouteChange('setup')");
    expect(start).toContain('saved.dictionaryId === currentDictionaryId');
    expect(start).toContain('sameWordSnapshot(saved.dictionaryWords, words)');
  });
});
