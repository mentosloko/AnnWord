export const HOME_NAVIGATION_EVENT = 'annword:navigate-home';
export const HOME_NAVIGATION_FLAG = 'annword_force_home_after_reload';

export const forceHomeNavigation = (): void => {
  try {
    window.sessionStorage.setItem(HOME_NAVIGATION_FLAG, '1');
    window.dispatchEvent(new CustomEvent(HOME_NAVIGATION_EVENT));
  } catch (_error) {
    window.location.href = window.location.origin;
  }
};
