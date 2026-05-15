import React from 'react';
import { AppHeader } from './layout/AppHeader';
import { AppModals } from './AppModals';
import { PetWidget } from './PetWidget';
import { PetState, UserProfile, ViewState } from '../types';

interface AppShellProps {
  route: ViewState;
  userProfile: UserProfile;
  pet: PetState;
  isAuthenticated: boolean;
  showLoginModal: boolean;
  showRulesModal: boolean;
  authMode: 'login' | 'register';
  tempUsername: string;
  tempPassword: string;
  authError: string | null;
  isAuthLoading: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => Promise<void>;
  onProfileClick: () => void;
  onShopClick: () => void;
  onNavigateToPetRoom: () => void;
  onCloseLogin: () => void;
  onCloseRules: () => void;
  onAuthModeChange: (mode: 'login' | 'register') => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onAuthSubmit: () => Promise<void>;
  onYandexLogin: () => Promise<void>;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children, route, userProfile, pet, isAuthenticated, showLoginModal, showRulesModal, authMode, tempUsername, tempPassword, authError, isAuthLoading, onLoginClick, onLogoutClick, onProfileClick, onShopClick, onNavigateToPetRoom, onCloseLogin, onCloseRules, onAuthModeChange, onUsernameChange, onPasswordChange, onAuthSubmit, onYandexLogin }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
    <AppHeader
      userProfile={userProfile}
      isAuthenticated={isAuthenticated}
      onLoginClick={onLoginClick}
      onLogoutClick={onLogoutClick}
      onProfileClick={onProfileClick}
      onShopClick={onShopClick}
    />

    {children}

    {route !== 'pet_room' && route !== 'shop' && route !== 'character_onboarding' && (
      <PetWidget pet={pet} onNavigateToPetRoom={onNavigateToPetRoom} />
    )}

    <AppModals
      showLoginModal={showLoginModal}
      showRulesModal={showRulesModal}
      authMode={authMode}
      tempUsername={tempUsername}
      tempPassword={tempPassword}
      authError={authError}
      isAuthLoading={isAuthLoading}
      onCloseLogin={onCloseLogin}
      onCloseRules={onCloseRules}
      onAuthModeChange={onAuthModeChange}
      onUsernameChange={onUsernameChange}
      onPasswordChange={onPasswordChange}
      onAuthSubmit={onAuthSubmit}
      onYandexLogin={onYandexLogin}
    />
  </div>
);