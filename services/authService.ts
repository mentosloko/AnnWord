import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export interface AuthBootstrapResult {
  session: Session | null;
  user: User | null;
}

export type AuthEventName = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'MFA_CHALLENGE_VERIFIED' | string;

export const authService = {
  getInitialSession: async (): Promise<AuthBootstrapResult> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      session: data.session,
      user: data.session?.user ?? null,
    };
  },

  signInWithYandex: async (): Promise<void> => {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: email.split('@')[0] } },
    });
    if (error) throw error;
    return { needsEmailConfirmation: Boolean(data.user && !data.session) };
  },

  signOut: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange: (callback: (event: AuthEventName, session: Session | null, user: User | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session, session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  },
};
