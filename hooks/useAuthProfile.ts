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

const getAuthErrorMessage = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message || '') : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Неверная электронная почта или пароль.';
  if (normalized.includes('email not confirmed')) return 'Подтвердите электронную почту перед входом.';
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) return 'Аккаунт с такой электронной почтой уже существует.';
  if (normalized.includes('password should be') || normalized.includes('weak password')) return 'Пароль слишком простой или короткий.';
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) return 'Слишком много попыток. Попробуйте позже.';
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова.';
  return fallback;
};

export const useAuthProfile = () => {
  const [initialSnapshot] = useState(() => profileCache.readSnapshot());
  const initialProfile = initialSnapshot?.profile || GUEST_PROFILE;
  const hasCachedProfile = Boolean(initialSnapshot);
  const initialCachedUserId = initialSnapshot?.userId || null;
  const [bootstrapStatus, setBootstrapStatus] = useState<AuthBootstrapStatus>(() => hasCachedProfile ? 'ready' : 'loading');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(!hasCachedProfile);
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...createInitialSettings(), username: initialProfile.username }));
  const [userProfile, setUserProfileState] = useState<UserProfile>(initialProfile);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cachedUserId, setCachedUserId] = useState<string | null>(initialCachedUserId);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const bootstrapCompleteRef = useRef(hasCachedProfile);
  const initialSessionCheckedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(initialCachedUserId);

  const setUserProfile = useCallback((next: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setUserProfileState(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: UserProfile) => UserProfile)(prev) : next;
      profileCache.write(resolved, currentUserIdRef.current);
      return resolved;
    });
  }, []);

  const resetToGuest = useCallback(() => {
    currentUserIdRef.current = null;
    setCachedUserId(null);
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
    const finishInitialCheck = (status: AuthBootstrapStatus, error: string | null = null) => {
      if (cancelled) return;
      initialSessionCheckedRef.current = true;
      bootstrapCompleteRef.current = true;
      setBootstrapStatus(status);
      setBootstrapError(error);
      setIsRestoringSession(false);
    };
    const failInitialCheck = (error: unknown, fallbackMessage: string) => {
      console.error(fallbackMessage, error);
      if (hasCachedProfile) finishInitialCheck('ready');
      else finishInitialCheck('error', getAuthErrorMessage(error, fallbackMessage));
    };
    authService.getInitialSession().then(async ({ user }) => {
      if (cancelled) return;
      if (!user) { resetToGuest(); finishInitialCheck('ready'); return; }
      currentUserIdRef.current = user.id;
      setCachedUserId(user.id);
      setCurrentUser(user);
      await loadProfileForUser(user);
      finishInitialCheck('ready');
    }).catch(error => failInitialCheck(error, 'Не удалось восстановить сессию.'));
    const silentlySyncAuthenticatedUser = async (event: AuthEventName, user: User) => {
      const isFreshLogin = event === 'SIGNED_IN' && currentUserIdRef.current !== user.id;
      try {
        if (event === 'TOKEN_REFRESHED') { currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user); return; }
        if (isFreshLogin) { await loadProfileForUser(user); if (cancelled) return; currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user); return; }
        currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') await loadProfileForUser(user);
      } catch (error: unknown) {
        console.error('Не удалось синхронизировать профиль пользователя.', error);
        if (isFreshLogin && !cancelled) setAuthError(getAuthErrorMessage(error, 'Не удалось загрузить профиль пользователя.'));
      } finally { if (event === 'SIGNED_IN' && !cancelled) setIsAuthLoading(false); }
    };
    const unsubscribe = authService.onAuthStateChange((event, _session, user) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT' || !user) { setIsAuthLoading(false); resetToGuest(); if (!initialSessionCheckedRef.current) finishInitialCheck('ready'); return; }
      if (!initialSessionCheckedRef.current) return;
      void silentlySyncAuthenticatedUser(event, user);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [hasCachedProfile, loadProfileForUser, resetToGuest]);

  const openLoginMode = useCallback(() => { setAuthMode('login'); setAuthError(null); }, []);
  const submitEmailAuth = useCallback(async () => {
    if (!tempUsername.trim() || !tempPassword.trim()) { setAuthError('Заполните все поля'); return false; }
    setIsAuthLoading(true); setAuthError(null); let profileWillLoadFromAuthEvent = false;
    try {
      if (authMode === 'login') { await authService.signInWithEmail(tempUsername, tempPassword); profileWillLoadFromAuthEvent = true; }
      else { const result = await authService.signUpWithEmail(tempUsername, tempPassword); if (result.needsEmailConfirmation) setAuthError('На вашу электронную почту отправлено письмо для подтверждения. Подтвердите её перед входом.'); else profileWillLoadFromAuthEvent = true; }
      setTempUsername(''); setTempPassword(''); return true;
    } catch (error: unknown) { setAuthError(getAuthErrorMessage(error, 'Не удалось войти. Попробуйте ещё раз.')); return false; }
    finally { if (!profileWillLoadFromAuthEvent) setIsAuthLoading(false); }
  }, [authMode, tempPassword, tempUsername]);
  const loginWithYandex = useCallback(async () => {
    setIsAuthLoading(true); setAuthError(null);
    try { await authService.signInWithYandex(); }
    catch (error: unknown) { setAuthError(getAuthErrorMessage(error, 'Не удалось войти через Яндекс.')); setIsAuthLoading(false); }
  }, []);
  const logout = useCallback(async () => { setIsAuthLoading(true); try { await authService.signOut(); } finally { setIsAuthLoading(false); resetToGuest(); } }, [resetToGuest]);

  return { bootstrapStatus, bootstrapError, isRestoringSession, settings, setSettings, userProfile, setUserProfile, currentUser, cachedUserId, isAuthenticated: Boolean(currentUser) || Boolean(cachedUserId), authMode, setAuthMode, tempUsername, setTempUsername, tempPassword, setTempPassword, authError, isAuthLoading, setAuthError, openLoginMode, submitEmailAuth, loginWithYandex, logout };
};