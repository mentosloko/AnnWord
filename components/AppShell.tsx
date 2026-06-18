import React from 'react';
import { AppHeader } from './layout/AppHeader';
import { AppModals } from './AppModals';
import { UserProfile, ViewState } from '../types';

interface AppShellProps {
  route: ViewState;
  userProfile: UserProfile;
  isAuthenticated: boolean;
  showLoginModal: boolean;
  showRulesModal: boolean;
  authMode: 'login' | 'register';
  tempUsername: string;
  tempPassword: string;
  authError: string | null;
  isAuthLoading: boolean;
  onHomeClick: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => Promise<void>;
  onProfileClick: () => void;
  onShopClick: () => void;
  onAdminClick?: () => void;
  onAdultRoomClick?: () => void;
  onDictionaryStudioClick?: () => void;
  onCloseLogin: () => void;
  onCloseRules: () => void;
  onAuthModeChange: (mode: 'login' | 'register') => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onAuthSubmit: () => Promise<void>;
  onYandexLogin: () => Promise<void>;
  children: React.ReactNode;
}

const GAME_ROUTES: ViewState[] = ['game', 'anagrams', 'translation', 'sprint', 'hangman', 'memory', 'letter_square'];

export const AppShell: React.FC<AppShellProps> = ({ route, children, userProfile, isAuthenticated, showLoginModal, showRulesModal, authMode, tempUsername, tempPassword, authError, isAuthLoading, onHomeClick, onLoginClick, onLogoutClick, onProfileClick, onShopClick, onAdminClick, onAdultRoomClick, onDictionaryStudioClick, onCloseLogin, onCloseRules, onAuthModeChange, onUsernameChange, onPasswordChange, onAuthSubmit, onYandexLogin }) => {
  const isGameRoute = GAME_ROUTES.includes(route);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
      {!isGameRoute && (
        <AppHeader
          route={route}
          userProfile={userProfile}
          isAuthenticated={isAuthenticated}
          onHomeClick={onHomeClick}
          onLoginClick={onLoginClick}
          onLogoutClick={onLogoutClick}
          onProfileClick={onProfileClick}
          onShopClick={onShopClick}
          onAdminClick={onAdminClick}
          onAdultRoomClick={onAdultRoomClick}
          onDictionaryStudioClick={onDictionaryStudioClick}
        />
      )}
      {children}
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
};