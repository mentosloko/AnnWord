import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ViewState } from '../types';

export type AppRoute = ViewState;

interface NavigationContextValue {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  goHome: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode; initialRoute?: AppRoute }> = ({ children, initialRoute = 'landing' }) => {
  const [route, setRoute] = useState<AppRoute>(initialRoute);

  const navigate = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
  }, []);

  const goHome = useCallback(() => {
    setRoute('landing');
  }, []);

  const value = useMemo<NavigationContextValue>(() => ({ route, navigate, goHome }), [route, navigate, goHome]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useAppNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useAppNavigation must be used within NavigationProvider');
  return context;
};
