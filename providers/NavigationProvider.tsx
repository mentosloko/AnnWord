import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ViewState } from '../types';

export type AppRoute = ViewState;

export const NAVIGATION_EVENT = 'annword:navigate';

interface NavigationEventDetail {
  route: AppRoute;
}

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
    window.dispatchEvent(new CustomEvent<NavigationEventDetail>(NAVIGATION_EVENT, { detail: { route: nextRoute } }));
  }, []);

  const goHome = useCallback(() => {
    navigate('landing');
  }, [navigate]);

  useEffect(() => {
    const handleExternalNavigation = (event: Event) => {
      const route = (event as CustomEvent<NavigationEventDetail>).detail?.route;
      if (!route) return;
      setRoute(route);
    };

    window.addEventListener(NAVIGATION_EVENT, handleExternalNavigation);
    return () => window.removeEventListener(NAVIGATION_EVENT, handleExternalNavigation);
  }, []);

  const value = useMemo<NavigationContextValue>(() => ({ route, navigate, goHome }), [route, navigate, goHome]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useAppNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useAppNavigation must be used within NavigationProvider');
  return context;
};
