import React from 'react';
import { AuthModal } from './auth/AuthModal';
import { RulesModal } from './modals/RulesModal';

interface AppModalsProps {
  showLoginModal: boolean;
  showRulesModal: boolean;
  authMode: 'login' | 'register';
  tempUsername: string;
  tempPassword: string;
  authError: string | null;
  isAuthLoading: boolean;
  onCloseLogin: () => void;
  onCloseRules: () => void;
  onAuthModeChange: (mode: 'login' | 'register') => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onAuthSubmit: () => void;
  onYandexLogin: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  showLoginModal,
  showRulesModal,
  authMode,
  tempUsername,
  tempPassword,
  authError,
  isAuthLoading,
  onCloseLogin,
  onCloseRules,
  onAuthModeChange,
  onUsernameChange,
  onPasswordChange,
  onAuthSubmit,
  onYandexLogin,
}) => {
  return (
    <>
      <AuthModal
        isOpen={showLoginModal}
        mode={authMode}
        email={tempUsername}
        password={tempPassword}
        error={authError}
        isLoading={isAuthLoading}
        onClose={onCloseLogin}
        onModeChange={onAuthModeChange}
        onEmailChange={onUsernameChange}
        onPasswordChange={onPasswordChange}
        onSubmit={onAuthSubmit}
        onYandexLogin={onYandexLogin}
      />
      <RulesModal isOpen={showRulesModal} onClose={onCloseRules} />
    </>
  );
};
