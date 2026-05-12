/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase URL or publishable key is missing. Auth and profile sync are disabled until Vercel env vars are configured.'
  );
}

const safeSupabaseUrl = supabaseUrl || 'https://example.supabase.co';
const safeSupabaseKey = supabaseAnonKey || 'missing-supabase-publishable-key';

export const supabase = createClient(safeSupabaseUrl, safeSupabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
