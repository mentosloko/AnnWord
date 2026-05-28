/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const configurationError = {
  message: 'Supabase не настроен для этого Vercel-деплоя: добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Vercel Environment Variables и пересоберите проект.'
};

const fakeQuery = {
  select: () => fakeQuery,
  eq: () => fakeQuery,
  order: () => fakeQuery,
  limit: () => fakeQuery,
  single: async () => ({ data: null, error: configurationError }),
  maybeSingle: async () => ({ data: null, error: configurationError }),
  insert: () => fakeQuery,
  update: () => fakeQuery
};

const fakeSupabaseClient = {
  supabaseUrl: '',
  auth: {
    onAuthStateChange: (callback: any) => {
      // Important: App.tsx waits for an auth event before leaving the initial
      // loading screen. If Supabase env vars are missing, the fake client must
      // still emit an INITIAL_SESSION event; otherwise the app stays stuck on
      // "Загрузка..." forever, including in incognito mode.
      window.setTimeout(() => {
        callback('INITIAL_SESSION', null);
      }, 0);

      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    signInWithOAuth: async () => ({ data: null, error: configurationError }),
    signInWithPassword: async () => ({ data: null, error: configurationError }),
    signUp: async () => ({ data: { user: null, session: null }, error: configurationError }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null })
  },
  from: () => fakeQuery,
  rpc: async () => ({ data: null, error: configurationError })
};

if (!isSupabaseConfigured) {
  console.warn(configurationError.message);
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : (fakeSupabaseClient as any);