import { BackendApiError, backendApiBaseUrl, backendApiRequest, isBackendApiConfigured, writeBackendAccessToken } from './backendApiClient';
import type { RegistrationConsentSnapshot } from './legalConsentService';
import type { AccountMode, DailyQuestState, UserProfile } from '../types';
import { dailyQuestService } from './dailyQuestService';

export interface AuthUser {
  id: string;
  aud: string;
  role?: string;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: {
    name?: string;
    full_name?: string;
    passwordResetRequired?: boolean;
    [key: string]: unknown;
  };
  identities?: unknown[];
  created_at: string;
  updated_at?: string;
  is_anonymous?: boolean;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: AuthUser;
}

export interface AuthBootstrapResult {
  session: AuthSession | null;
  user: AuthUser | null;
}

export type AuthEventName = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'MFA_CHALLENGE_VERIFIED' | string;

type BackendUserPayload = {
  id: string;
  email: string;
  name?: string;
  passwordResetRequired?: boolean;
};

type BackendSessionPayload = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: BackendUserPayload | null;
  profile?: UserProfile | null;
  quest?: DailyQuestState | null;
};

type BackendRegistrationPayload = BackendSessionPayload & {
  ok?: boolean;
  needsEmailConfirmation?: boolean;
  message?: string;
};

type BackendBootstrapPayload = {
  user?: BackendUserPayload | null;
  profile?: UserProfile | null;
  quest?: DailyQuestState | null;
};

type AuthSubscriber = (event: AuthEventName, session: AuthSession | null, user: AuthUser | null) => void;
const backendSubscribers = new Set<AuthSubscriber>();
let currentBackendAuth: AuthBootstrapResult = { session: null, user: null };
let pendingRegisteredProfile: { userId: string; profile: UserProfile } | null = null;
const EXPLICIT_LOGOUT_STORAGE_KEY = 'annword_explicit_logout_v1';
const backendRequiredError = (): Error => new Error('Основной сервер AnnWord не настроен для этого запуска.');

export const consumePendingRegisteredProfile = (userId: string): UserProfile | null => {
  if (!pendingRegisteredProfile || pendingRegisteredProfile.userId !== userId) return null;
  const profile = pendingRegisteredProfile.profile;
  pendingRegisteredProfile = null;
  return profile;
};

const primeBackendPayload = (payload: BackendSessionPayload | BackendBootstrapPayload): void => {
  if (payload.user && payload.profile) {
    pendingRegisteredProfile = { userId: payload.user.id, profile: payload.profile };
  }
  if ('quest' in payload) dailyQuestService.primeTodayQuest(payload.quest);
};

const clearPrimedBootstrap = (): void => {
  pendingRegisteredProfile = null;
  dailyQuestService.primeTodayQuest(undefined);
};

const readExplicitLogout = (): boolean => {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(EXPLICIT_LOGOUT_STORAGE_KEY) === '1'; } catch { return false; }
};
const writeExplicitLogout = (value: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(EXPLICIT_LOGOUT_STORAGE_KEY, '1');
    else window.localStorage.removeItem(EXPLICIT_LOGOUT_STORAGE_KEY);
  } catch { /* local storage must not block auth */ }
};
const delay = (ms: number): Promise<void> => new Promise(resolve => window.setTimeout(resolve, ms));
const isTransientAuthError = (error: unknown): boolean => {
  if (error instanceof BackendApiError) return error.status === 0 || error.status >= 500;
  return error instanceof TypeError || /network|fetch|connection/i.test(error instanceof Error ? error.message : String(error || ''));
};
const withTransientRetry = async <T,>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientAuthError(error)) throw error;
    await delay(450);
    return operation();
  }
};

const toAuthUser = (user: BackendUserPayload): AuthUser => ({
  id: user.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: user.email,
  email_confirmed_at: new Date(0).toISOString(),
  phone: '',
  confirmed_at: new Date(0).toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {
    name: user.name,
    full_name: user.name,
    passwordResetRequired: user.passwordResetRequired === true,
  },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date().toISOString(),
});

const toSession = (payload: BackendSessionPayload): AuthSession | null => {
  if (!payload.user) return null;
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 60 * 60 * 24 * 30;
  return {
    access_token: payload.access_token || '',
    token_type: payload.token_type || 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: '',
    user: toAuthUser(payload.user),
  };
};

const toAuthBootstrap = (payload: BackendSessionPayload): AuthBootstrapResult => {
  const session = toSession(payload);
  return { session, user: session?.user ?? null };
};

const emitBackendAuth = (event: AuthEventName, auth: AuthBootstrapResult): void => {
  backendSubscribers.forEach((subscriber) => subscriber(event, auth.session, auth.user));
};

export const authService = {
  getInitialSession: async (): Promise<AuthBootstrapResult> => {
    if (!isBackendApiConfigured) {
      clearPrimedBootstrap();
      currentBackendAuth = { session: null, user: null };
      return currentBackendAuth;
    }
    if (readExplicitLogout()) {
      clearPrimedBootstrap();
      currentBackendAuth = { session: null, user: null };
      return currentBackendAuth;
    }
    try {
      const data = await withTransientRetry(() => backendApiRequest<BackendBootstrapPayload>('/api/profile/bootstrap'));
      primeBackendPayload(data);
      currentBackendAuth = data.user ? toAuthBootstrap({ user: data.user }) : { session: null, user: null };
      return currentBackendAuth;
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 401) {
        clearPrimedBootstrap();
        currentBackendAuth = { session: null, user: null };
        return currentBackendAuth;
      }
      throw error;
    }
  },

  signInWithYandex: async (): Promise<void> => {
    if (!isBackendApiConfigured) throw backendRequiredError();
    writeExplicitLogout(false);
    window.location.href = `${backendApiBaseUrl}/api/auth/yandex`;
  },

  signInWithEmail: async (email: string, password: string): Promise<void> => {
    if (!isBackendApiConfigured) throw backendRequiredError();
    clearPrimedBootstrap();
    const payload = await withTransientRetry(() => backendApiRequest<BackendSessionPayload>('/api/auth/email/session', {
      method: 'POST',
      body: { email, credential: password },
    }));
    writeExplicitLogout(false);
    primeBackendPayload(payload);
    currentBackendAuth = toAuthBootstrap(payload);
    emitBackendAuth('SIGNED_IN', currentBackendAuth);
  },

  signUpWithEmail: async (email: string, password: string, consents: RegistrationConsentSnapshot, accountMode?: AccountMode): Promise<{ needsEmailConfirmation: boolean }> => {
    if (!isBackendApiConfigured) throw backendRequiredError();
    const payload = await withTransientRetry(() => backendApiRequest<BackendRegistrationPayload>('/api/auth/email/account', {
      method: 'POST',
      body: { email, credential: password, name: email.split('@')[0], consents, accountMode },
    }));
    writeExplicitLogout(false);
    if (payload.needsEmailConfirmation !== false || !payload.user) {
      clearPrimedBootstrap();
      currentBackendAuth = { session: null, user: null };
      return { needsEmailConfirmation: true };
    }
    primeBackendPayload(payload);
    currentBackendAuth = toAuthBootstrap(payload);
    emitBackendAuth('SIGNED_IN', currentBackendAuth);
    return { needsEmailConfirmation: false };
  },

  signOut: async (): Promise<void> => {
    clearPrimedBootstrap();
    writeExplicitLogout(true);
    writeBackendAccessToken(null);
    currentBackendAuth = { session: null, user: null };
    emitBackendAuth('SIGNED_OUT', currentBackendAuth);
    if (!isBackendApiConfigured) return;

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await backendApiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
        return;
      } catch (error) {
        lastError = error;
        await delay(250);
      }
    }
    console.warn('Backend logout request failed after local sign-out', lastError);
  },

  onAuthStateChange: (callback: AuthSubscriber) => {
    backendSubscribers.add(callback);
    callback('INITIAL_SESSION', currentBackendAuth.session, currentBackendAuth.user);
    return () => backendSubscribers.delete(callback);
  },
};
