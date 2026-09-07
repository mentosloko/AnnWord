import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveActiveDictionaryDescriptor } from '../services/activeDictionaryDescriptor';
import { ensureSpotlightDictionaryLoaded, getSpotlightCompactSelectionLabel, getSpotlightGrades, getSpotlightSections, getSpotlightSelectionLabel, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from '../services/spotlightDictionary';
import type { GameSettings, UserProfile } from '../types';

const findGradeWithSections = (minimum: number) => {
  for (const grade of getSpotlightGrades()) {
    const sections = getSpotlightSections(grade).filter(section => section.wordCount > 0);
    if (sections.length >= minimum) return { grade, sections };
  }
  throw new Error(`Spotlight fixture needs at least ${minimum} populated sections in one grade.`);
};

const profile: UserProfile = {
  username: 'Kid',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  featureFlags: { premiumDictionaries: true },
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Бадди', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [] },
  coins: 0,
  inventory: [],
};

const baseSettings: GameSettings = {
  username: 'Kid',
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'premium',
  difficulty: 'ALL',
  activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
};

describe('dictionary navigation and labels', () => {
  it('returns parent and practice editors to the dictionary chooser while teachers return to their workspace', () => {
    const appScreens = readFileSync('components/AppScreens.tsx', 'utf8');
    expect(appScreens).toContain("onBack={() => onRouteChange(isTeacher ? 'adult_room' : 'dictionary_settings')}");
    expect(appScreens).not.toContain("isParentAccount || isTeacher ? 'adult_room' : 'dictionary_settings'");
  });

  it('uses the concrete Spotlight section title in the shared selection label', async () => {
    await ensureSpotlightDictionaryLoaded();
    const section = getSpotlightSections(3).find(item => item.wordCount > 0);
    expect(section).toBeTruthy();
    expect(getSpotlightSelectionLabel(3, section!.id)).toBe(`3 класс · ${section!.title}`);
  });

  it('shows all selected module names in settings and a bounded summary in game surfaces', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(3);
    const sectionIds = sections.slice(0, 3).map(section => section.id);
    const full = getSpotlightSelectionLabel(grade, sectionIds);
    const compact = getSpotlightCompactSelectionLabel(grade, sectionIds);
    const descriptor = resolveActiveDictionaryDescriptor({
      ...baseSettings,
      activeSpotlightGrade: grade,
      activeSpotlightSectionId: sectionIds[0],
      activeSpotlightSectionIds: sectionIds,
    }, profile, true);

    sections.slice(0, 3).forEach(section => expect(full).toContain(section.title));
    expect(compact).toContain('+ ещё 1');
    expect(descriptor.title).toBe(`Школьные (Spotlight) · ${compact}`);
    expect(descriptor.title.length).toBeLessThan(`Школьные (Spotlight) · ${full}`.length);
  });
});
