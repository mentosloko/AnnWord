import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { BackendApiError, backendApiBaseUrl, backendApiRequest, isBackendApiConfigured, writeBackendAccessToken } from './backendApiClient';

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
};

type BackendMePayload = {
  user?: BackendUserPayload | null;
};

type AuthSubscriber = (event: AuthEventName, session: Session | null, user: User | null) => void;
const backendSubscribers = new Set<AuthSubscriber>();
let currentBackendAuth: AuthBootstrapResult = { session: null, user: null };

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
      try {
        const data = await backendApiRequest<BackendMePayload>('/api/auth/me');
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
      currentBackendAuth = toAuthBootstrap(await backendApiRequest<BackendSessionPayload>('/api/auth/email/session', {
        method: 'POST',
        body: { email, credential: password },
      }));
      emitBackendAuth('SIGNED_IN', currentBackendAuth);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> => {
    if (isBackendApiConfigured) {
      currentBackendAuth = toAuthBootstrap(await backendApiRequest<BackendSessionPayload>('/api/auth/email/account', {
        method: 'POST',
        body: { email, credential: password, name: email.split('@')[0] },
      }));
      emitBackendAuth('SIGNED_IN', currentBackendAuth);
      return { needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: email.split('@')[0] } },
    });
    if (error) throw error;
    return { needsEmailConfirmation: Boolean(data.user && !data.session) };
  },

  signOut: async (): Promise<void> => {
    if (isBackendApiConfigured) {
      const logoutRequest = backendApiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }).catch((error) => {
        console.warn('Backend logout request failed after local sign-out', error);
      });
      writeBackendAccessToken(null);
      currentBackendAuth = { session: null, user: null };
      emitBackendAuth('SIGNED_OUT', currentBackendAuth);
      await logoutRequest;
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