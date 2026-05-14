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

export const KNOWN_ROUTES: ViewState[] = [
  'landing',
  'profile',
  'setup',
  'game',
  'review',
  'anagrams',
  'sprint',
  'hangman',
  'memory',
  'shop',
  'pet_room',
  'admin',
];

export const isKnownRoute = (route: string): route is ViewState => {
  return (KNOWN_ROUTES as string[]).includes(route);
};
