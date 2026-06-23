/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;
const backendApiUrl = viteEnv.VITE_API_URL;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const isBackendApiConfigured = Boolean(backendApiUrl);

const configurationError = {
  message: 'Supabase не настроен для этого деплоя. Для Yandex-контуров используйте backend API; для Supabase-контуров добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY и пересоберите проект.'
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

const scheduleInitialSession = (callback: any): void => {
  const emit = () => callback('INITIAL_SESSION', null);
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(emit, 0);
    return;
  }
  setTimeout(emit, 0);
};

const fakeSupabaseClient = {
  supabaseUrl: '',
  auth: {
    onAuthStateChange: (callback: any) => {
      // Important: App.tsx waits for an auth event before leaving the initial
      // loading screen. If Supabase env vars are missing, the fake client must
      // still emit an INITIAL_SESSION event; otherwise the app stays stuck on
      // "Загрузка..." forever, including in incognito mode.
      scheduleInitialSession(callback);

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

if (!isSupabaseConfigured && !isBackendApiConfigured && typeof console !== 'undefined') {
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
