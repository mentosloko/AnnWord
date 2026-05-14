import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { userService } from '../services/userService';
import { useAuthSession } from './AuthProvider';

export const GUEST_PROFILE: UserProfile = {
  username: 'Guest',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Owl',
    type: 'Owl',
    level: 1,
    mood: 'neutral',
    xp: 0,
    hunger: 100,
    energy: 100,
    equippedAccessories: []
  },
  coins: 100,
  inventory: []
};

interface ProfileContextValue {
  profile: UserProfile;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<UserProfile>;
  setProfileOptimistic: (updater: UserProfile | ((profile: UserProfile) => UserProfile)) => void;
  rollbackProfile: (profile?: UserProfile) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isReady } = useAuthSession();
  const [profile, setProfile] = useState<UserProfile>(GUEST_PROFILE);
  const [lastStableProfile, setLastStableProfile] = useState<UserProfile>(GUEST_PROFILE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (): Promise<UserProfile> => {
    if (!user) {
      setProfile(GUEST_PROFILE);
      setLastStableProfile(GUEST_PROFILE);
      return GUEST_PROFILE;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loadedProfile = await userService.getOrCreateProfile(
        user.id,
        user.user_metadata?.full_name || user.user_metadata?.name || 'Guest',
        user.email || undefined,
      );
      setProfile(loadedProfile);
      setLastStableProfile(loadedProfile);
      return loadedProfile;
    } catch (error: any) {
      setError(error?.message || 'Не удалось загрузить профиль');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isReady) return;
    loadProfile().catch(() => undefined);
  }, [isReady, loadProfile]);

  const value = useMemo<ProfileContextValue>(() => ({
    profile,
    isLoading,
    error,
    refreshProfile: loadProfile,
    setProfileOptimistic: (updater) => {
      setProfile(prev => typeof updater === 'function' ? (updater as (profile: UserProfile) => UserProfile)(prev) : updater);
    },
    rollbackProfile: (fallback) => setProfile(fallback || lastStableProfile),
  }), [profile, isLoading, error, loadProfile, lastStableProfile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useUserProfile = (): ProfileContextValue => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useUserProfile must be used within ProfileProvider');
  return context;
};
