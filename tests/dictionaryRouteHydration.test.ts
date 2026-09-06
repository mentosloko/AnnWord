import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appScreens = readFileSync('components/AppScreens.tsx', 'utf8');

describe('dictionary route hydration', () => {
  it('waits for the dictionary runtime before mounting dictionary-dependent routes', () => {
    expect(appScreens).toContain("DICTIONARY_RUNTIME_ROUTES = new Set<ViewState>(['setup', 'game', 'anagrams', 'translation', 'sprint', 'memory', 'hangman', 'letter_square'])");
    expect(appScreens).toContain("dictionaryRuntime.status === 'loading'");
    expect(appScreens).toContain('dictionaryRuntime.getModeWords({ respectWordLength: false })');
    expect(appScreens).toContain('snapshotWords || resolvedModeWords');
  });

  it('hydrates Spotlight before rendering home, profile, or dictionary summaries', () => {
    expect(appScreens).toContain('SPOTLIGHT_PREMIUM_DICTIONARY_ID');
    expect(appScreens).toContain("DICTIONARY_SUMMARY_ROUTES = new Set<ViewState>(['landing', 'profile', 'dictionary_settings'])");
    expect(appScreens).toContain('spotlightSummaryNeedsRuntime');
  });
});
