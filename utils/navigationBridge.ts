import { AppRoute, NAVIGATION_EVENT } from '../providers/NavigationProvider';

export const HOME_NAVIGATION_EVENT = 'annword:navigate-home';
export const HOME_NAVIGATION_FLAG = 'annword_force_home_after_reload';

export const navigateToRoute = (route: AppRoute): void => {
  window.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: { route } }));
};

export const forceHomeNavigation = (): void => {
  try {
    navigateToRoute('landing');
    window.dispatchEvent(new CustomEvent(HOME_NAVIGATION_EVENT));
  } catch (_error) {
    window.location.href = window.location.origin;
  }
};
