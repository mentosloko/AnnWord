export type AppScreen =
  | 'home'
  | 'game'
  | 'shop'
  | 'pet'
  | 'settings'
  | 'stats'
  | 'leaderboard'
  | 'admin'
  | 'login';

export const HOME_SCREEN: AppScreen = 'home';

export interface NavigationState {
  currentScreen: AppScreen;
  previousScreen: AppScreen | null;
}

export const createInitialNavigationState = (currentScreen: AppScreen = HOME_SCREEN): NavigationState => ({
  currentScreen,
  previousScreen: null,
});

export const navigateToScreen = (
  state: NavigationState,
  nextScreen: AppScreen,
): NavigationState => {
  if (state.currentScreen === nextScreen) return state;

  return {
    currentScreen: nextScreen,
    previousScreen: state.currentScreen,
  };
};

export const navigateHome = (state: NavigationState): NavigationState => ({
  currentScreen: HOME_SCREEN,
  previousScreen: state.currentScreen === HOME_SCREEN ? null : state.currentScreen,
});

export const canGoBack = (state: NavigationState): boolean => Boolean(state.previousScreen);

export const navigateBack = (state: NavigationState): NavigationState => {
  if (!state.previousScreen) return navigateHome(state);

  return {
    currentScreen: state.previousScreen,
    previousScreen: null,
  };
};

export const isSecondaryScreen = (screen: AppScreen): boolean => screen !== HOME_SCREEN && screen !== 'game';
