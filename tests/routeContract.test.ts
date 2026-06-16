import { describe, expect, it } from 'vitest';
import { isKnownRoute, KNOWN_ROUTES } from '../components/AppRouter';
import { ViewState } from '../types';

describe('route contracts', () => {
  it('contains every supported ViewState route exactly once', () => {
    const requiredRoutes: ViewState[] = ['landing', 'profile', 'setup', 'game', 'review', 'anagrams', 'translation', 'sprint', 'memory', 'hangman', 'shop', 'pet_room', 'account_mode_setup', 'character_onboarding', 'family_setup', 'adult_room', 'dictionary_settings', 'dictionary_studio', 'premium', 'admin'];
    expect(new Set(KNOWN_ROUTES).size).toBe(KNOWN_ROUTES.length);
    expect(KNOWN_ROUTES).toHaveLength(requiredRoutes.length);
    expect([...KNOWN_ROUTES].sort()).toEqual([...requiredRoutes].sort());
    for (const route of requiredRoutes) expect(isKnownRoute(route)).toBe(true);
  });

  it('rejects legacy and unknown routes', () => {
    expect(isKnownRoute('anagram')).toBe(false);
    expect(isKnownRoute('petroom')).toBe(false);
    expect(isKnownRoute('pet-room')).toBe(false);
    expect(isKnownRoute('stats')).toBe(false);
    expect(isKnownRoute('unknown')).toBe(false);
  });
});
