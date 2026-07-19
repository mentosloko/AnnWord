import { UserProfile } from '../types';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { mapProfileFromDB, normalizeDictionaryField, normalizePet, normalizeStats } from './profileMapper';

const PROFILE_CACHE_KEY = 'annword_cached_profile_v2';
const LEGACY_PROFILE_CACHE_KEY = 'annword_cached_profile_v1';
const PROFILE_CACHE_VERSION = 2;

export type ProfileFreshness = 'loading' | 'cached' | 'fresh' | 'none';

interface CachedProfilePayload {
  version: number;
  savedAt: number;
  userId?: string | null;
  profile: UserProfile;
}

export interface CachedProfileSnapshot {
  profile: UserProfile;
  userId: string | null;
  savedAt: number;
}

const freshnessListeners = new Set<() => void>();
let freshness: ProfileFreshness = 'loading';

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const notifyFreshness = (): void => freshnessListeners.forEach(listener => listener());
const setFreshness = (next: ProfileFreshness): void => {
  if (freshness === next) return;
  freshness = next;
  notifyFreshness();
};
const markCachedIfNeeded = (): void => {
  if (freshness === 'loading' || freshness === 'none') setFreshness('cached');
};

const normalizeStringArray = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)))
  : [];

const normalizeProfile = (profile: UserProfile): UserProfile => {
  try {
    const mapped = mapProfileFromDB({
      username: profile.username || GUEST_PROFILE.username,
      role: profile.role || 'user',
      account_mode: profile.accountMode,
      subscription_tier: profile.subscriptionTier,
      premium_expires_at: profile.premiumExpiresAt,
      child_display_name: profile.childDisplayName,
      child_share_code: profile.childShareCode,
      child_slots_limit: profile.childSlotsLimit,
      feature_flags: profile.featureFlags,
      custom_dictionary_en: normalizeDictionaryField(profile.customDictionaryEn || []),
      dictionary_collections: Array.isArray(profile.dictionaryCollections) ? profile.dictionaryCollections : [],
      managed_learners: Array.isArray(profile.managedLearners) ? profile.managedLearners : [],
      weekly_report_email: profile.weeklyReportEmail,
      stats: normalizeStats(profile.stats),
      pet: normalizePet(profile.pet),
      coins: Math.max(0, Math.round(profile.coins || 0)),
      inventory: Array.isArray(profile.inventory) ? profile.inventory : [],
    });
    return {
      ...mapped,
      assignedWords: normalizeStringArray(profile.assignedWords),
    };
  } catch {
    return GUEST_PROFILE;
  }
};

const readPayload = (): CachedProfilePayload | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfilePayload;
    if (!parsed || parsed.version !== PROFILE_CACHE_VERSION || !parsed.profile || !Number.isFinite(parsed.savedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const clearLegacyCache = (): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(LEGACY_PROFILE_CACHE_KEY);
  } catch {
    // Legacy cleanup must not block application startup.
  }
};

export const profileCache = {
  read: (): UserProfile | null => {
    const payload = readPayload();
    if (payload) markCachedIfNeeded();
    return payload ? normalizeProfile(payload.profile) : null;
  },

  readSnapshot: (): CachedProfileSnapshot | null => {
    clearLegacyCache();
    const payload = readPayload();
    if (!payload) return null;
    markCachedIfNeeded();
    return {
      profile: normalizeProfile(payload.profile),
      userId: payload.userId || null,
      savedAt: payload.savedAt,
    };
  },

  write: (profile: UserProfile, userId?: string | null): void => {
    if (!isBrowser()) return;
    try {
      const payload: CachedProfilePayload = {
        version: PROFILE_CACHE_VERSION,
        savedAt: Date.now(),
        userId: userId || null,
        profile: normalizeProfile(profile),
      };
      window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
      clearLegacyCache();
      setFreshness('fresh');
    } catch {
      // Cache should never break gameplay.
    }
  },

  clear: (): void => {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(PROFILE_CACHE_KEY);
      window.localStorage.removeItem(LEGACY_PROFILE_CACHE_KEY);
    } catch {
      // Ignore storage errors.
    } finally {
      setFreshness('none');
    }
  },

  getFreshness: (): ProfileFreshness => freshness,
  subscribeFreshness: (listener: () => void): (() => void) => {
    freshnessListeners.add(listener);
    return () => freshnessListeners.delete(listener);
  },
};
