import type { ViewState } from '../types';
import { ClientEntryPath, getEntryPathFromPathname, getEntryPathUrl } from './clientEntryPath';

export interface ClientLocationState {
  route: ViewState;
  entryPath: ClientEntryPath;
}

export type ClientAuthMode = 'login' | 'register';

const ROUTE_PATHS: Record<Exclude<ViewState, 'landing'>, string> = {
  profile: '/profile',
  setup: '/play/setup',
  game: '/play/classic',
  review: '/review',
  anagrams: '/play/anagrams',
  translation: '/play/one-of-two',
  sprint: '/play/sprint',
  hangman: '/play/hangman',
  memory: '/play/memory',
  letter_square: '/play/snake',
  shop: '/shop',
  pet_room: '/pet',
  account_mode_setup: '/onboarding/mode',
  character_onboarding: '/onboarding/character',
  family_setup: '/onboarding/family',
  admin: '/admin',
  adult_room: '/workspace',
  dictionary_settings: '/dictionary',
  dictionary_studio: '/dictionary/edit',
  premium: '/premium',
  premium_success: '/premium/success',
};

const AUTH_PATHS: Record<ClientAuthMode, string> = {
  login: '/login',
  register: '/register',
};

const PATH_ROUTES = new Map<string, ViewState>(
  Object.entries(ROUTE_PATHS).map(([route, path]) => [path, route as ViewState]),
);

const normalizePathname = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';

export const getClientAuthModeFromPathname = (pathname: string): ClientAuthMode | null => {
  const normalized = normalizePathname(pathname);
  if (normalized === AUTH_PATHS.login) return 'login';
  if (normalized === AUTH_PATHS.register) return 'register';
  return null;
};

export const getClientLocationFromPathname = (pathname: string): ClientLocationState => {
  const normalized = normalizePathname(pathname);
  const entryPath = getEntryPathFromPathname(normalized);
  const isEntryPath = normalized === '/' || entryPath !== 'home';
  if (isEntryPath || getClientAuthModeFromPathname(normalized)) return { route: 'landing', entryPath: 'home' };
  return { route: PATH_ROUTES.get(normalized) || 'landing', entryPath: 'home' };
};

export const getInitialClientLocation = (): ClientLocationState => {
  if (typeof window === 'undefined') return { route: 'landing', entryPath: 'home' };
  return getClientLocationFromPathname(window.location.pathname);
};

const onboardingAudience = (entryPath: ClientEntryPath): string => {
  if (entryPath === 'practice') return '?audience=practice';
  if (entryPath === 'kids') return '?audience=kids';
  if (entryPath === 'teacher') return '?audience=teacher';
  return '';
};

export const getClientRouteUrl = (route: ViewState, entryPath: ClientEntryPath): string => {
  if (route === 'landing') return getEntryPathUrl(entryPath);
  if (route === 'account_mode_setup') return `${ROUTE_PATHS.account_mode_setup}${onboardingAudience(entryPath)}`;
  return ROUTE_PATHS[route];
};

export const getKnownClientPaths = (): string[] => [
  '/',
  '/practice',
  '/kids',
  '/teacher',
  '/landing-mix',
  ...Object.values(AUTH_PATHS),
  ...Object.values(ROUTE_PATHS),
];
