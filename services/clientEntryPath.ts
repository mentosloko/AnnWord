export type ClientEntryPath = 'home' | 'practice' | 'kids' | 'teacher';

const ENTRY_PATHS: Record<ClientEntryPath, string> = {
  home: '/',
  practice: '/practice',
  kids: '/kids',
  teacher: '/teacher',
};

export const getEntryPathUrl = (entryPath: ClientEntryPath): string => ENTRY_PATHS[entryPath];

export const getEntryPathFromPathname = (pathname: string): ClientEntryPath => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/practice') return 'practice';
  if (normalized === '/kids') return 'kids';
  if (normalized === '/teacher') return 'teacher';
  return 'home';
};

export const getInitialEntryPath = (): ClientEntryPath => {
  if (typeof window === 'undefined') return 'home';
  return getEntryPathFromPathname(window.location.pathname);
};