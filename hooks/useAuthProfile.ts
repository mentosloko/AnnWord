import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authService, AuthEventName, AuthBootstrapResult } from '../services/authService';
import { backendApiRequest, isBackendApiConfigured } from '../services/backendApiClient';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { DictionarySource, DifficultyLevel, GameSettings, UserProfile, WordLength } from '../types';
import { profileCache } from '../services/profileCache';
import { preserveEstablishedAccountAccess } from '../services/profileAccessState';

export type AuthMode = 'login' | 'register';
export type AuthBootstrapStatus = 'loading' | 'ready' | 'error';

type PersistedGameSettings = Partial<Pick<GameSettings, 'wordLength' | 'useCustomDictionary' | 'dictionarySource' | 'difficulty' | 'activePremiumDictionaryId'>>;
const SETTINGS_STORAGE_PREFIX = 'annword_game_settings_v1:';
const isWordLength = (value: unknown): value is WordLength => value === 4 || value === 5 || value === 6;
const isDictionarySource = (value: unknown): value is DictionarySource => value === 'builtin' || value === 'custom' || value === 'premium';
const isDifficulty = (value: unknown): value is DifficultyLevel => value === 'ALL' || value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2' || value === 'C1' || value === 'C2';
const isPaymentReturn = (): boolean => {
  if (typeof window === 'undefined') return false;
  const payment = new URLSearchParams(window.location.search).get('payment');
  return payment === 'success' || payment === 'fail';
};
const takeYandexOauthCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('oauth_code');
  if (!code) return null;
  params.delete('oauth_code');
  params.delete('auth');
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}` || '/');
  return code;
};
const consumeYandexOauthCode = async (): Promise<void> => {
  if (!isBackendApiConfigured) return;
  const code = takeYandexOauthCode();
  if (!code) return;
  await backendApiRequest('/api/auth/yandex/exchange', { method: 'POST', body: { code } });
};
const sleep = (ms: number): Promise<void> => new Promise(resolve => window.setTimeout(resolve, ms));
const getInitialSessionWithPaymentRetry = async (paymentReturn: boolean): Promise<AuthBootstrapResult> => {
  await consumeYandexOauthCode();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await authService.getInitialSession();
      if (!paymentReturn || result.user || attempt === 2) return result;
    } catch (error) {
      lastError = error;
      if (!paymentReturn || attempt === 2) throw error;
    }
    await sleep(500 + attempt * 500);
  }
  if (lastError) throw lastError;
  return authService.getInitialSession();
};
const readStoredSettings = (userId: string | null): PersistedGameSettings => {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${SETTINGS_STORAGE_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: PersistedGameSettings = {};
    if (isWordLength(parsed.wordLength)) next.wordLength = parsed.wordLength;
    if (typeof parsed.useCustomDictionary === 'boolean') next.useCustomDictionary = parsed.useCustomDictionary;
    if (isDictionarySource(parsed.dictionarySource)) next.dictionarySource = parsed.dictionarySource;
    if (isDifficulty(parsed.difficulty)) next.difficulty = parsed.difficulty;
    if (typeof parsed.activePremiumDictionaryId === 'string') next.activePremiumDictionaryId = parsed.activePremiumDictionaryId;
    return next;
  } catch {
    return {};
  }
};
const writeStoredSettings = (userId: string | null, settings: GameSettings): void => {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SETTINGS_STORAGE_PREFIX}${userId}`, JSON.stringify({
      wordLength: settings.wordLength,
      useCustomDictionary: settings.useCustomDictionary,
      dictionarySource: settings.dictionarySource,
      difficulty: settings.difficulty,
      activePremiumDictionaryId: settings.activePremiumDictionaryId,
    }));
  } catch {
    // Local preference persistence must not break auth/profile loading.
  }
};
const isUserProfile = (value: unknown): value is UserProfile => {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<UserProfile>;
  return typeof profile.username === 'string'
    && Array.isArray(profile.customDictionaryEn)
    && Boolean(profile.stats)
    && typeof profile.stats === 'object'
    && Boolean(profile.pet)
    && typeof profile.pet === 'object'
    && typeof profile.coins === 'number'
    && Array.isArray(profile.inventory);
};

export const createInitialSettings = (): GameSettings => ({ wordLength: 5, useCustomDictionary: false, dictionarySource: 'builtin', difficulty: 'ALL', username: 'Гость' });
const getAuthErrorMessage = (error: unknown, fallback: string): string => { const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message || '') : ''; const normalized = message.toLowerCase(); if (normalized.includes('перенесён из старой системы') || normalized.includes('legacy_password_reset_required')) return message || 'Аккаунт перенесён из старой системы. Войдите через Яндекс с тем же email.'; if (normalized.includes('invalid login credentials')) return 'Неверная электронная почта или пароль.'; if (normalized.includes('email not confirmed')) return 'Подтвердите электронную почту перед входом.'; if (normalized.includes('user already registered') || normalized.includes('already been registered') || normalized.includes('already exists') || normalized.includes('duplicate key') || normalized.includes('уже существует')) return 'Аккаунт с такой электронной почтой уже существует.'; if (normalized.includes('password should be') || normalized.includes('weak password')) return 'Пароль слишком простой или короткий.'; if (normalized.includes('rate limit') || normalized.includes('too many requests')) return 'Слишком много попыток. Попробуйте позже.'; if (normalized.includes('network') || normalized.includes('fetch')) return 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова.'; return message || fallback; };

export const useAuthProfile = () => {
  const [initialSnapshot] = useState(() => profileCache.readSnapshot());
  const initialProfile = initialSnapshot?.profile || GUEST_PROFILE;
  const hasCachedProfile = Boolean(initialSnapshot);
  const cachedProfileHasEstablishedAccess = initialProfile.role === 'admin' || Boolean(initialProfile.accountMode);
  const initialCachedUserId = initialSnapshot?.userId || null;
  const paymentReturnRef = useRef(isPaymentReturn());
  const [bootstrapStatus, setBootstrapStatus] = useState<AuthBootstrapStatus>('loading');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...createInitialSettings(), ...readStoredSettings(initialCachedUserId), username: initialProfile.username }));
  const [userProfile, setUserProfileState] = useState<UserProfile>(initialProfile);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cachedUserId, setCachedUserId] = useState<string | null>(initialCachedUserId);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const bootstrapCompleteRef = useRef(false);
  const initialSessionCheckedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(initialCachedUserId);
  const setUserProfile = useCallback((next: UserProfile | ((prev: UserProfile) => UserProfile)) => { setUserProfileState(prev => { const resolved = typeof next === 'function' ? (next as (prev: UserProfile) => UserProfile)(prev) : next; const safeProfile = preserveEstablishedAccountAccess(prev, resolved); profileCache.write(safeProfile, currentUserIdRef.current); return safeProfile; }); }, []);
  useEffect(() => { if (typeof window === 'undefined') return; const handle = (event: Event) => { const profile = (event as CustomEvent<UserProfile>).detail; if (!isUserProfile(profile)) return; setUserProfile(profile); setSettings(previous => ({ ...previous, username: profile.username })); }; window.addEventListener('annword:profile-updated', handle as EventListener); return () => window.removeEventListener('annword:profile-updated', handle as EventListener); }, [setUserProfile]);
  const resetToGuest = useCallback(() => { currentUserIdRef.current = null; setCachedUserId(null); setCurrentUser(null); profileCache.clear(); setUserProfileState(GUEST_PROFILE); setSettings(createInitialSettings()); }, []);
  const loadProfileForUser = useCallback(async (user: User) => { const { userService } = await import('../services/userService'); const profile = await userService.getOrCreateProfile(user.id, user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Пользователь', user.email || undefined); profileCache.write(profile, user.id); setUserProfileState(profile); setSettings(prev => ({ ...prev, ...readStoredSettings(user.id), username: profile.username })); }, []);
  useEffect(() => { let cancelled = false; const paymentReturn = paymentReturnRef.current; const finishInitialCheck = (status: AuthBootstrapStatus, error: string | null = null) => { if (cancelled) return; initialSessionCheckedRef.current = true; bootstrapCompleteRef.current = true; setBootstrapStatus(status); setBootstrapError(error); setIsRestoringSession(false); }; const keepCachedProfileReady = (): boolean => { if (!hasCachedProfile || !initialCachedUserId) return false; currentUserIdRef.current = initialCachedUserId; setCachedUserId(initialCachedUserId); finishInitialCheck('ready'); return true; }; const failInitialCheck = (error: unknown, fallbackMessage: string) => { console.error(fallbackMessage, error); if ((paymentReturn && keepCachedProfileReady()) || (hasCachedProfile && cachedProfileHasEstablishedAccess)) finishInitialCheck('ready'); else finishInitialCheck('error', getAuthErrorMessage(error, fallbackMessage)); }; getInitialSessionWithPaymentRetry(paymentReturn).then(async ({ user }) => { if (cancelled) return; if (!user) { if (paymentReturn && keepCachedProfileReady()) return; resetToGuest(); finishInitialCheck('ready'); return; } currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user); await loadProfileForUser(user); finishInitialCheck('ready'); }).catch(error => failInitialCheck(error, 'Не удалось восстановить сессию.')); const silentlySyncAuthenticatedUser = async (event: AuthEventName, user: User) => { const isFreshLogin = event === 'SIGNED_IN' && currentUserIdRef.current !== user.id; try { if (event === 'TOKEN_REFRESHED') { currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user); return; } if (isFreshLogin) { await loadProfileForUser(user); if (cancelled) return; currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user); return; } currentUserIdRef.current = user.id; setCachedUserId(user.id); setCurrentUser(user); if (event === 'SIGNED_IN' || event === 'USER_UPDATED') await loadProfileForUser(user); } catch (error: unknown) { console.error('Не удалось синхронизировать профиль пользователя.', error); if (isFreshLogin && !cancelled) setAuthError(getAuthErrorMessage(error, 'Не удалось загрузить профиль пользователя.')); } finally { if (event === 'SIGNED_IN' && !cancelled) setIsAuthLoading(false); } }; const unsubscribe = authService.onAuthStateChange((event, _session, user) => { if (event === 'INITIAL_SESSION') return; if (event === 'SIGNED_OUT' || !user) { setIsAuthLoading(false); if (paymentReturn && keepCachedProfileReady()) return; resetToGuest(); if (!initialSessionCheckedRef.current) finishInitialCheck('ready'); return; } if (!initialSessionCheckedRef.current) return; void silentlySyncAuthenticatedUser(event, user); }); return () => { cancelled = true; unsubscribe(); }; }, [cachedProfileHasEstablishedAccess, hasCachedProfile, initialCachedUserId, loadProfileForUser, resetToGuest]);
  useEffect(() => { if (!currentUser) return; setTempUsername(''); setTempPassword(''); }, [currentUser]);
  useEffect(() => { if (isRestoringSession) return; writeStoredSettings(currentUser?.id || cachedUserId, settings); }, [cachedUserId, currentUser?.id, isRestoringSession, settings]);
  const openLoginMode = useCallback(() => { setAuthMode('login'); setAuthError(null); setTempPassword(''); }, []);
  const openRegisterMode = useCallback(() => { setAuthMode('register'); setAuthError(null); setTempPassword(''); }, []);
  const submitEmailAuth = useCallback(async () => { if (!tempUsername.trim() || !tempPassword.trim()) { setAuthError('Заполните все поля'); return false; } setIsAuthLoading(true); setAuthError(null); let profileWillLoadFromAuthEvent = false; try { if (authMode === 'login') { await authService.signInWithEmail(tempUsername, tempPassword); profileWillLoadFromAuthEvent = true; } else { const result = await authService.signUpWithEmail(tempUsername, tempPassword); if (result.needsEmailConfirmation) setAuthError('На вашу электронную почту отправлено письмо для подтверждения. Подтвердите её перед входом.'); else profileWillLoadFromAuthEvent = true; } return true; } catch (error: unknown) { setAuthError(getAuthErrorMessage(error, 'Не удалось войти. Попробуйте ещё раз.')); return false; } finally { if (!profileWillLoadFromAuthEvent) setIsAuthLoading(false); } }, [authMode, tempPassword, tempUsername]);
  const loginWithYandex = useCallback(async () => { setIsAuthLoading(true); setAuthError(null); try { await authService.signInWithYandex(); } catch (error: unknown) { setAuthError(getAuthErrorMessage(error, 'Не удалось войти через Яндекс.')); setIsAuthLoading(false); } }, []);
  const logout = useCallback(async () => { setIsAuthLoading(true); try { await authService.signOut(); } finally { setIsAuthLoading(false); resetToGuest(); } }, [resetToGuest]);
  return { bootstrapStatus, bootstrapError, isRestoringSession, settings, setSettings, userProfile, setUserProfile, currentUser, cachedUserId, isAuthenticated: Boolean(currentUser) || Boolean(cachedUserId), authMode, setAuthMode, tempUsername, setTempUsername, tempPassword, setTempPassword, authError, isAuthLoading, setAuthError, openLoginMode, openRegisterMode, submitEmailAuth, loginWithYandex, logout };
};