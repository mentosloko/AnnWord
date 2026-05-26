import { UserProfile } from '../types';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { mapProfileFromDB, normalizeDictionaryField, normalizePet, normalizeStats } from './profileMapper';

const PROFILE_CACHE_KEY = 'annword_cached_profile_v1';
const PROFILE_CACHE_VERSION = 1;

interface CachedProfilePayload {
  version: number;
  savedAt: number;
  userId?: string | null;
  profile: UserProfile;
}

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeProfile = (profile: UserProfile): UserProfile => {
  try {
    return mapProfileFromDB({
      username: profile.username || GUEST_PROFILE.username,
      role: profile.role || 'user',
      custom_dictionary_en: normalizeDictionaryField(profile.customDictionaryEn || []),
      stats: normalizeStats(profile.stats),
      pet: normalizePet(profile.pet),
      coins: Math.max(0, Math.round(profile.coins || 0)),
      inventory: Array.isArray(profile.inventory) ? profile.inventory : [],
    });
  } catch {
    return GUEST_PROFILE;
  }
};

export const profileCache = {
  read: (): UserProfile | null => {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedProfilePayload;
      if (!parsed || parsed.version !== PROFILE_CACHE_VERSION || !parsed.profile) return null;
      return normalizeProfile(parsed.profile);
    } catch {
      return null;
    }
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
    } catch {
      // Cache should never break gameplay.
    }
  },

  clear: (): void => {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      // Ignore storage errors.
    }
  },
};
