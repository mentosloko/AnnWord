export type ClientEntryPath = 'home' | 'practice' | 'kids' | 'teacher' | 'landing_mix';

const ENTRY_PATHS: Record<ClientEntryPath, string> = {
  home: '/',
  practice: '/practice',
  kids: '/kids',
  teacher: '/teacher',
  landing_mix: '/landing-mix',
};

export const getEntryPathUrl = (entryPath: ClientEntryPath): string => ENTRY_PATHS[entryPath];

export const getEntryPathFromPathname = (pathname: string): ClientEntryPath => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/practice') return 'practice';
  if (normalized === '/kids') return 'kids';
  if (normalized === '/teacher') return 'teacher';
  if (normalized === '/landing-mix') return 'landing_mix';
  return 'home';
};

export const getInitialEntryPath = (): ClientEntryPath => {
  if (typeof window === 'undefined') return 'home';
  return getEntryPathFromPathname(window.location.pathname);
};