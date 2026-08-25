import React from 'react';
import { AppHeader } from './layout/AppHeader';
import { LegalFooter } from './layout/LegalFooter';
import { MobileBottomNav } from './layout/MobileBottomNav';
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
  onRegisterClick: () => void;
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

const navigateToDictionarySelection = (fallback?: () => void): void => {
  if (typeof window === 'undefined') {
    fallback?.();
    return;
  }
  const path = '/dictionary';
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const AppShell: React.FC<AppShellProps> = ({ route, children, userProfile, isAuthenticated, showLoginModal, showRulesModal, authMode, tempUsername, tempPassword, authError, isAuthLoading, onHomeClick, onLoginClick, onRegisterClick, onLogoutClick, onProfileClick, onShopClick, onAdminClick, onAdultRoomClick, onDictionaryStudioClick, onCloseLogin, onCloseRules, onAuthModeChange, onUsernameChange, onPasswordChange, onAuthSubmit, onYandexLogin }) => {
  const isGameRoute = GAME_ROUTES.includes(route);
  const showMobileNav = isAuthenticated && !isGameRoute;
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const onDictionaryClick = isTeacher
    ? onDictionaryStudioClick
    : () => navigateToDictionarySelection(onDictionaryStudioClick);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
      {!isGameRoute && (
        <AppHeader
          route={route}
          userProfile={userProfile}
          isAuthenticated={isAuthenticated}
          onHomeClick={onHomeClick}
          onLoginClick={onLoginClick}
          onRegisterClick={onRegisterClick}
          onLogoutClick={onLogoutClick}
          onProfileClick={onProfileClick}
          onShopClick={onShopClick}
          onAdminClick={onAdminClick}
          onAdultRoomClick={onAdultRoomClick}
          onDictionaryStudioClick={onDictionaryClick}
        />
      )}
      <div className={`flex-1 ${showMobileNav ? 'pb-20 lg:pb-0' : ''}`}>{children}</div>
      {!isGameRoute && <LegalFooter />}
      {!isGameRoute && <MobileBottomNav route={route} userProfile={userProfile} isAuthenticated={isAuthenticated} onHomeClick={onHomeClick} onProfileClick={onProfileClick} onShopClick={onShopClick} onAdultRoomClick={onAdultRoomClick} onDictionaryStudioClick={onDictionaryClick} />}
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