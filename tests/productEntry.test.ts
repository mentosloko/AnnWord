import { describe, expect, it } from 'vitest';
import {
  PRODUCT_ENTRY_URLS,
  getAccountModeForRegistrationEntry,
  getCanonicalEntryPathForAccountMode,
  getProductEntryPathFromPathname,
  getRegistrationEntryPath,
  isLegacyProductEntry,
} from '../services/productEntry';

describe('product entry contract', () => {
  it('keeps stable public and legacy URLs', () => {
    expect(PRODUCT_ENTRY_URLS.home).toBe('/');
    expect(PRODUCT_ENTRY_URLS.kids).toBe('/kids');
    expect(PRODUCT_ENTRY_URLS.teacher).toBe('/teacher');
    expect(PRODUCT_ENTRY_URLS.practice).toBe('/practice');
    expect(PRODUCT_ENTRY_URLS.landing_mix).toBe('/landing-mix');
    expect(getProductEntryPathFromPathname('/teacher/')).toBe('teacher');
  });

  it('defaults generic public registration to the parent product', () => {
    expect(getRegistrationEntryPath('home')).toBe('kids');
    expect(getRegistrationEntryPath('kids')).toBe('kids');
    expect(getRegistrationEntryPath('landing_mix')).toBe('kids');
    expect(getAccountModeForRegistrationEntry('kids')).toBe('parent');
  });

  it('preserves explicit teacher and legacy practice registration', () => {
    expect(getRegistrationEntryPath('teacher')).toBe('teacher');
    expect(getAccountModeForRegistrationEntry('teacher')).toBe('teacher');
    expect(getRegistrationEntryPath('practice')).toBe('practice');
    expect(getAccountModeForRegistrationEntry('practice')).toBe('player');
  });

  it('keeps existing account modes on their canonical homes', () => {
    expect(getCanonicalEntryPathForAccountMode('parent')).toBe('kids');
    expect(getCanonicalEntryPathForAccountMode('teacher')).toBe('teacher');
    expect(getCanonicalEntryPathForAccountMode('player')).toBe('practice');
    expect(getCanonicalEntryPathForAccountMode(null)).toBe('home');
    expect(isLegacyProductEntry('practice')).toBe(true);
    expect(isLegacyProductEntry('home')).toBe(false);
  });
});
