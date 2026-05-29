import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authService, AuthEventName } from '../services/authService';
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
  username: 'Гость',
});

export const useAuthProfile = () => {
  const cachedProfile = profileCache.read();
  const initialProfile = cachedProfile || GUEST_PROFILE;
  const [bootstrapStatus, setBootstrapStatus] = useState<AuthBootstrapStatus>('loading');
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
  const bootstrapCompleteRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const setUserProfile = useCallback((next: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setUserProfileState(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: UserProfile) => UserProfile)(prev) : next;
      profileCache.write(resolved, currentUserIdRef.current);
      return resolved;
    });
  }, []);

  const resetToGuest = useCallback(() => {
    currentUserIdRef.current = null;
    setCurrentUser(null);
    profileCache.clear();
    setUserProfileState(GUEST_PROFILE);
    setSettings(createInitialSettings());
  }, []);

  const loadProfileForUser = useCallback(async (user: User) => {
    const { userService } = await import('../services/userService');
    const profile = await userService.getOrCreateProfile(
      user.id,
      user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Пользователь',
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
      bootstrapCompleteRef.current = true;
      setBootstrapStatus(status);
      setBootstrapError(error);
      setIsRestoringSession(false);
    };

    const failInitialBootstrap = (error: any, fallbackMessage: string) => {
      console.error(fallbackMessage, error);
      finishBootstrap('error', error?.message || fallbackMessage);
    };

    authService.getInitialSession()
      .then(async ({ user }) => {
        if (cancelled) return;
        if (!user) {
          resetToGuest();
          finishBootstrap('ready');
          return;
        }

        currentUserIdRef.current = user.id;
        setCurrentUser(user);
        await loadProfileForUser(user);
        finishBootstrap('ready');
      })
      .catch(error => failInitialBootstrap(error, 'Не удалось восстановить сессию.'));

    const silentlySyncAuthenticatedUser = async (event: AuthEventName, user: User) => {
      const isFreshLogin = event === 'SIGNED_IN' && currentUserIdRef.current !== user.id;

      try {
        if (event === 'TOKEN_REFRESHED') {
          currentUserIdRef.current = user.id;
          setCurrentUser(user);
          return;
        }

        if (isFreshLogin) {
          await loadProfileForUser(user);
          if (cancelled) return;
          currentUserIdRef.current = user.id;
          setCurrentUser(user);
          return;
        }

        currentUserIdRef.current = user.id;
        setCurrentUser(user);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await loadProfileForUser(user);
        }
      } catch (error: any) {
        console.error('Не удалось синхронизировать профиль пользователя.', error);
        if (isFreshLogin && !cancelled) {
          setAuthError(error?.message || 'Не удалось загрузить профиль пользователя.');
        }
      } finally {
        if (event === 'SIGNED_IN' && !cancelled) setIsAuthLoading(false);
      }
    };

    const unsubscribe = authService.onAuthStateChange((event, _session, user) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !user) {
        setIsAuthLoading(false);
        resetToGuest();
        if (!bootstrapCompleteRef.current) finishBootstrap('ready');
        return;
      }

      if (!bootstrapCompleteRef.current) return;
      void silentlySyncAuthenticatedUser(event, user);
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
    let profileWillLoadFromAuthEvent = false;

    try {
      if (authMode === 'login') {
        await authService.signInWithEmail(tempUsername, tempPassword);
        profileWillLoadFromAuthEvent = true;
      } else {
        const result = await authService.signUpWithEmail(tempUsername, tempPassword);
        if (result.needsEmailConfirmation) {
          setAuthError('На ваш email отправлено письмо для подтверждения. Пожалуйста, подтвердите его перед входом.');
        } else {
          profileWillLoadFromAuthEvent = true;
        }
      }
      setTempUsername('');
      setTempPassword('');
      return true;
    } catch (error: any) {
      setAuthError(error?.message || 'Ошибка авторизации');
      return false;
    } finally {
      if (!profileWillLoadFromAuthEvent) setIsAuthLoading(false);
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

  return {
    bootstrapStatus,
    bootstrapError,
    isRestoringSession,
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
