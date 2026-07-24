import type { UserProfile, ViewState } from '../types';

const GAME_ROUTES = new Set<ViewState>(['setup', 'game', 'anagrams', 'translation', 'sprint', 'hangman', 'memory', 'letter_square']);
const PRACTICE_ROUTES = new Set<ViewState>([
  'landing', 'profile', ...GAME_ROUTES, 'dictionary_settings', 'dictionary_studio', 'premium', 'premium_success',
]);
const KIDS_ROUTES = new Set<ViewState>([
  'landing', 'profile', ...GAME_ROUTES, 'shop', 'pet_room', 'adult_room', 'dictionary_settings', 'dictionary_studio', 'premium', 'premium_success',
]);
const TEACHER_ROUTES = new Set<ViewState>(['landing', 'adult_room', 'dictionary_studio', 'profile']);

export const resolveAccessibleRoute = (route: ViewState, profile: UserProfile, isAuthenticated: boolean): ViewState => {
  if (!isAuthenticated) return 'landing';
  if (profile.role === 'admin') return route === 'review' ? 'profile' : route;

  const mode = profile.accountMode || (profile.role === 'parent' ? 'parent' : profile.role === 'teacher' ? 'teacher' : undefined);
  if (!mode) return 'account_mode_setup';

  if (mode === 'parent') {
    const hasChild = Boolean(profile.childDisplayName || profile.childShareCode || profile.pet.characterOnboarded);
    if (!hasChild) return route === 'family_setup' ? route : 'family_setup';
    if (!profile.pet.characterOnboarded) {
      return route === 'character_onboarding' || route === 'premium' || route === 'premium_success' ? route : 'character_onboarding';
    }
    return KIDS_ROUTES.has(route) ? route : 'landing';
  }

  if (mode === 'teacher') return TEACHER_ROUTES.has(route) ? route : 'adult_room';
  if (route === 'review') return 'profile';
  return PRACTICE_ROUTES.has(route) ? route : 'landing';
};

export const canAccessRoute = (route: ViewState, profile: UserProfile, isAuthenticated: boolean): boolean => resolveAccessibleRoute(route, profile, isAuthenticated) === route;
