import { describe, expect, it } from 'vitest';
import { getClientLocationFromPathname, getClientRouteUrl } from '../services/clientRoute';
import { getPremiumSuccessRoute } from '../services/premiumIntent';

describe('client route mapping', () => {
  it('maps public audience landings without treating them as internal screens', () => {
    expect(getClientLocationFromPathname('/practice')).toEqual({ route: 'landing', entryPath: 'practice' });
    expect(getClientLocationFromPathname('/kids/')).toEqual({ route: 'landing', entryPath: 'kids' });
    expect(getClientLocationFromPathname('/teacher')).toEqual({ route: 'landing', entryPath: 'teacher' });
  });

  it('maps internal URLs and creates stable URLs for important screens', () => {
    expect(getClientLocationFromPathname('/premium')).toEqual({ route: 'premium', entryPath: 'home' });
    expect(getClientLocationFromPathname('/dictionary/edit')).toEqual({ route: 'dictionary_studio', entryPath: 'home' });
    expect(getClientLocationFromPathname('/play/one-of-two')).toEqual({ route: 'translation', entryPath: 'home' });
    expect(getClientRouteUrl('profile', 'practice')).toBe('/profile');
    expect(getClientRouteUrl('landing', 'kids')).toBe('/kids');
  });

  it('falls back to the root landing for unknown paths', () => {
    expect(getClientLocationFromPathname('/does-not-exist')).toEqual({ route: 'landing', entryPath: 'home' });
  });
});

describe('Premium return intent', () => {
  const createdAt = new Date().toISOString();

  it('returns a custom dictionary buyer to the editor', () => {
    expect(getPremiumSuccessRoute({ kind: 'custom_dictionary', returnTo: 'dictionary_settings', createdAt }, false)).toBe('dictionary_studio');
  });

  it('returns a parent who enabled reports to the parent cabinet', () => {
    expect(getPremiumSuccessRoute({ kind: 'weekly_report', returnTo: 'adult_room', createdAt }, true)).toBe('adult_room');
  });

  it('does not loop back into Premium', () => {
    expect(getPremiumSuccessRoute({ kind: 'general', returnTo: 'premium', createdAt }, false)).toBe('landing');
  });
});
