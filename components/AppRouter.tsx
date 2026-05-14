import React from 'react';
import { ViewState } from '../types';

export interface AppRouterProps {
  route: ViewState;
  screens: Partial<Record<ViewState, React.ReactNode>>;
  fallback?: React.ReactNode;
}

export const AppRouter: React.FC<AppRouterProps> = ({ route, screens, fallback = null }) => {
  return <>{screens[route] ?? fallback}</>;
};

export const isKnownRoute = (route: string): route is ViewState => {
  return [
    'landing',
    'setup',
    'game',
    'anagram',
    'sprint',
    'memory',
    'hangman',
    'shop',
    'pet_room',
    'stats',
  ].includes(route);
};
