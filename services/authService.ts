import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { BackendApiError, backendApiBaseUrl, backendApiRequest, isBackendApiConfigured, writeBackendAccessToken } from './backendApiClient';
import type { RegistrationConsentSnapshot } from './legalConsentService';
import type { UserProfile } from '../types';

export interface AuthBootstrapResult {
  session: Session | null;
  user: User | null;
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
};

type BackendMePayload = {
  user?: BackendUserPayload | null;
};

type AuthSubscriber = (event: AuthEventName, session: Session | null, user: User | null) => void;
const backendSubscribers = new Set<AuthSubscriber>();
let currentBackendAuth: AuthBootstrapResult = { session: null, user: null };
let pendingRegisteredProfile: { userId: string; profile: UserProfile } | null = null;
const EXPLICIT_LOGOUT_STORAGE_KEY = 'annword_explicit_logout_v1';

export const consumePendingRegisteredProfile = (userId: string): UserProfile | null => {
  if (!pendingRegisteredProfile || pendingRegisteredProfile.userId !== userId) return null;
  const profile = pendingRegisteredProfile.profile;
  pendingRegisteredProfile = null;
  return profile;
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

const toSupabaseUser = (user: BackendUserPayload): User => ({
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
} as unknown as User);

const toSession = (payload: BackendSessionPayload): Session | null => {
  if (!payload.user) return null;
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 60 * 60 * 24 * 30;
  return {
    access_token: payload.access_token || '',
    token_type: payload.token_type || 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: '',
    user: toSupabaseUser(payload.user),
  } as unknown as Session;
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
    if (isBackendApiConfigured) {
      if (readExplicitLogout()) {
        currentBackendAuth = { session: null, user: null };
        return currentBackendAuth;
      }
      try {
        const data = await withTransientRetry(() => backendApiRequest<BackendMePayload>('/api/auth/me'));
        currentBackendAuth = data.user ? toAuthBootstrap({ user: data.user }) : { session: null, user: null };
        return currentBackendAuth;
      } catch (error) {
        if (error instanceof BackendApiError && error.status === 401) {
          currentBackendAuth = { session: null, user: null };
          return currentBackendAuth;
        }
        throw error;
      }
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      session: data.session,
      user: data.session?.user ?? null,
    };
  },

  signInWithYandex: async (): Promise<void> => {
    if (isBackendApiConfigured) {
      writeExplicitLogout(false);
      window.location.href = `${backendApiBaseUrl}/api/auth/yandex`;
      return;
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'yandex' as any,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      return;
    }

    window.location.href = '/api/auth/yandex';
  },

  signInWithEmail: async (email: string, password: string): Promise<void> => {
    if (isBackendApiConfigured) {
      pendingRegisteredProfile = null;
      const payload = await withTransientRetry(() => backendApiRequest<BackendSessionPayload>('/api/auth/email/session', {
        method: 'POST',
        body: { email, credential: password },
      }));
      writeExplicitLogout(false);
      currentBackendAuth = toAuthBootstrap(payload);
      emitBackendAuth('SIGNED_IN', currentBackendAuth);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email: string, password: string, consents: RegistrationConsentSnapshot): Promise<{ needsEmailConfirmation: boolean }> => {
    if (isBackendApiConfigured) {
      const payload = await withTransientRetry(() => backendApiRequest<BackendSessionPayload>('/api/auth/email/account', {
        method: 'POST',
        body: { email, credential: password, name: email.split('@')[0], consents },
      }));
      writeExplicitLogout(false);
      if (payload.user && payload.profile) pendingRegisteredProfile = { userId: payload.user.id, profile: payload.profile };
      currentBackendAuth = toAuthBootstrap(payload);
      emitBackendAuth('SIGNED_IN', currentBackendAuth);
      return { needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: email.split('@')[0], legal_consents: consents } },
    });
    if (error) throw error;
    return { needsEmailConfirmation: Boolean(data.user && !data.session) };
  },

  signOut: async (): Promise<void> => {
    if (isBackendApiConfigured) {
      pendingRegisteredProfile = null;
      writeExplicitLogout(true);
      writeBackendAccessToken(null);
      currentBackendAuth = { session: null, user: null };
      emitBackendAuth('SIGNED_OUT', currentBackendAuth);
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
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange: (callback: (event: AuthEventName, session: Session | null, user: User | null) => void) => {
    if (isBackendApiConfigured) {
      backendSubscribers.add(callback);
      callback('INITIAL_SESSION', currentBackendAuth.session, currentBackendAuth.user);
      return () => backendSubscribers.delete(callback);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session, session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  },
};