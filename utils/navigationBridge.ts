const HOME_QUERY = 'screen=home';

export const forceHomeNavigation = (): void => {
  try {
    window.dispatchEvent(new CustomEvent('annword:navigate-home'));
    window.history.replaceState({}, document.title, `${window.location.origin}/?${HOME_QUERY}&t=${Date.now()}`);
    window.location.reload();
  } catch (_error) {
    window.location.href = `${window.location.origin}/?${HOME_QUERY}&t=${Date.now()}`;
  }
};
