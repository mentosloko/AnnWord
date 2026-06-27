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

export const KNOWN_ROUTES: ViewState[] = ['landing', 'profile', 'setup', 'game', 'review', 'anagrams', 'translation', 'sprint', 'hangman', 'memory', 'letter_square', 'shop', 'pet_room', 'account_mode_setup', 'character_onboarding', 'family_setup', 'adult_room', 'dictionary_settings', 'dictionary_studio', 'premium', 'premium_success', 'admin'];

export const isKnownRoute = (route: string): route is ViewState => {
  return (KNOWN_ROUTES as string[]).includes(route);
};