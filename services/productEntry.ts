import type { AccountMode } from '../types';

export type ProductEntryPath = 'home' | 'practice' | 'kids' | 'teacher' | 'landing_mix';
export type RegistrationEntryPath = 'practice' | 'kids' | 'teacher';

export const PRODUCT_ENTRY_URLS: Record<ProductEntryPath, string> = {
  home: '/',
  practice: '/practice',
  kids: '/kids',
  teacher: '/teacher',
  landing_mix: '/landing-mix',
};

export const getProductEntryPathFromPathname = (pathname: string): ProductEntryPath => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === PRODUCT_ENTRY_URLS.practice) return 'practice';
  if (normalized === PRODUCT_ENTRY_URLS.kids) return 'kids';
  if (normalized === PRODUCT_ENTRY_URLS.teacher) return 'teacher';
  if (normalized === PRODUCT_ENTRY_URLS.landing_mix) return 'landing_mix';
  return 'home';
};

export const getRegistrationEntryPath = (entryPath: ProductEntryPath): RegistrationEntryPath => {
  if (entryPath === 'teacher') return 'teacher';
  if (entryPath === 'practice') return 'practice';
  return 'kids';
};

export const getAccountModeForRegistrationEntry = (entryPath: RegistrationEntryPath): AccountMode => {
  if (entryPath === 'teacher') return 'teacher';
  if (entryPath === 'practice') return 'player';
  return 'parent';
};

export const getCanonicalEntryPathForAccountMode = (mode?: AccountMode | null): ProductEntryPath => {
  if (mode === 'parent') return 'kids';
  if (mode === 'teacher') return 'teacher';
  if (mode === 'player') return 'practice';
  return 'home';
};

export const isRegistrationEntryPath = (value: unknown): value is RegistrationEntryPath =>
  value === 'practice' || value === 'kids' || value === 'teacher';

export const isLegacyProductEntry = (entryPath: ProductEntryPath): boolean =>
  entryPath === 'practice' || entryPath === 'landing_mix';
