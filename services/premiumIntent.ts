import type { ViewState } from '../types';

export type PremiumIntentKind =
  | 'general'
  | 'custom_dictionary'
  | 'dictionary_settings'
  | 'game_setup'
  | 'kids_teacher_code'
  | 'weekly_report'
  | 'character_onboarding';

export interface PremiumIntentState {
  kind: PremiumIntentKind;
  returnTo: ViewState;
  createdAt: string;
}

const STORAGE_KEY = 'annword_premium_intent_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const safeStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage; } catch { return null; }
};

export const rememberPremiumIntent = (kind: PremiumIntentKind, returnTo: ViewState): PremiumIntentState => {
  const value: PremiumIntentState = { kind, returnTo, createdAt: new Date().toISOString() };
  try { safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore unavailable storage */ }
  return value;
};

export const readPremiumIntent = (): PremiumIntentState | null => {
  try {
    const raw = safeStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PremiumIntentState>;
    const createdAt = typeof parsed.createdAt === 'string' ? Date.parse(parsed.createdAt) : Number.NaN;
    if (!parsed.kind || !parsed.returnTo || !Number.isFinite(createdAt) || Date.now() - createdAt > MAX_AGE_MS) {
      safeStorage()?.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as PremiumIntentState;
  } catch {
    return null;
  }
};

export const clearPremiumIntent = (): void => {
  try { safeStorage()?.removeItem(STORAGE_KEY); } catch { /* ignore unavailable storage */ }
};

export const getPremiumSuccessRoute = (intent: PremiumIntentState | null, isParent: boolean): ViewState => {
  if (!intent) return isParent ? 'adult_room' : 'dictionary_settings';
  if (intent.kind === 'custom_dictionary') return 'dictionary_studio';
  if (intent.kind === 'dictionary_settings') return 'dictionary_settings';
  if (intent.kind === 'game_setup') return 'setup';
  if (intent.kind === 'kids_teacher_code' || intent.kind === 'weekly_report') return 'adult_room';
  if (intent.kind === 'character_onboarding') return 'character_onboarding';
  return intent.returnTo === 'premium' || intent.returnTo === 'premium_success' ? 'landing' : intent.returnTo;
};
