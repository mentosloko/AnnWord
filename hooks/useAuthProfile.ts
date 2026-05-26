import { useCallback, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authService } from '../services/authService';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { GameSettings, UserProfile } from '../types';
import { profileCache } from '../services/profileCache';

export type AuthMode = 'login' | 'register';
export type AuthBootstrapStatus = 'loading' | 'ready' | 'error';

export const createInitialSettings = (): GameSettings => ({
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Guest',
});

export const useAuthProfile = () => {
  const cachedProfile = profileCache.read();
  const initialProfile = cachedProfile || GUEST_PROFILE;
  const [bootstrapStatus, setBootstrapStatus] = useState<AuthBootstrapStatus>('ready');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...createInitialSettings(), username: initialProfile.username }));
  const [userProfile, setUserProfileState] = useState<UserProfile>(initialProfile);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const setUserProfile = useCallback((next: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setUserProfileState(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: UserProfile) => UserProfile)(prev) : next;
      profileCache.write(resolved, currentUser?.id ?? null);
      return resolved;
    });
  }, [currentUser?.id]);

  const resetToGuest = useCallback(() => {
    setCurrentUser(null);
    profileCache.clear();
    setUserProfileState(GUEST_PROFILE);
    setSettings(createInitialSettings());
  }, []);

  const loadProfileForUser = useCallback(async (user: User) => {
    const { userService } = await import('../services/userService');
    const profile = await userService.getOrCreateProfile(
      user.id,
      user.user_metadata?.full_name || user.user_metadata?.name || 'Guest',
      user.email || undefined,
    );
    profileCache.write(profile, user.id);
    setUserProfileState(profile);
    setSettings(prev => ({ ...prev, username: profile.username }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const finishBootstrap = (status: AuthBootstrapStatus, error: string | null = null) => {
      if (cancelled) return;
      setBootstrapStatus(status);
      setBootstrapError(error);
      setIsRestoringSession(false);
    };

    authService.getInitialSession()
      .then(async ({ user }) => {
        if (cancelled) return;
        setCurrentUser(user);
        if (user) await loadProfileForUser(user);
        finishBootstrap('ready');
      })
      .catch(error => {
        console.error('Initial auth bootstrap failed', error);
        finishBootstrap('error', error?.message || 'Не удалось восстановить сессию.');
      });

    const unsubscribe = authService.onAuthStateChange(async (_session, user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);

      if (user) {
        try {
          await loadProfileForUser(user);
        } catch (error) {
          console.error('Failed to load user profile after auth change', error);
        }
      } else if (!isRestoringSession) {
        resetToGuest();
      }

      finishBootstrap('ready');
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadProfileForUser, resetToGuest]);

  const openLoginMode = useCallback(() => {
    setAuthMode('login');
    setAuthError(null);
  }, []);

  const submitEmailAuth = useCallback(async () => {
    if (!tempUsername.trim() || !tempPassword.trim()) {
      setAuthError('Заполните все поля');
      return false;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'login') {
        await authService.signInWithEmail(tempUsername, tempPassword);
      } else {
        const result = await authService.signUpWithEmail(tempUsername, tempPassword);
        if (result.needsEmailConfirmation) {
          setAuthError('На ваш email отправлено письмо для подтверждения. Пожалуйста, подтвердите его перед входом.');
        }
      }
      setTempUsername('');
      setTempPassword('');
      return true;
    } catch (error: any) {
      setAuthError(error?.message || 'Ошибка авторизации');
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [authMode, tempPassword, tempUsername]);

  const loginWithYandex = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await authService.signInWithYandex();
    } catch (error: any) {
      setAuthError(error?.message || 'Ошибка входа через Яндекс');
      setIsAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      await authService.signOut();
    } finally {
      setIsAuthLoading(false);
      resetToGuest();
    }
  }, [resetToGuest]);

  const continueAsGuestAfterBootstrapError = useCallback(() => {
    resetToGuest();
    setBootstrapError(null);
    setBootstrapStatus('ready');
    setIsRestoringSession(false);
  }, [resetToGuest]);

  return {
    bootstrapStatus,
    bootstrapError,
    isRestoringSession,
    continueAsGuestAfterBootstrapError,
    settings,
    setSettings,
    userProfile,
    setUserProfile,
    currentUser,
    isAuthenticated: Boolean(currentUser),
    authMode,
    setAuthMode,
    tempUsername,
    setTempUsername,
    tempPassword,
    setTempPassword,
    authError,
    isAuthLoading,
    setAuthError,
    openLoginMode,
    submitEmailAuth,
    loginWithYandex,
    logout,
  };
};