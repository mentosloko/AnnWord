import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ensureSpotlightDictionaryLoaded, getSpotlightSections, getSpotlightSelectionLabel } from '../services/spotlightDictionary';

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
});
