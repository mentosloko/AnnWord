import { useSyncExternalStore } from 'react';
import { profileCache, ProfileFreshness } from '../services/profileCache';

const getServerSnapshot = (): ProfileFreshness => 'loading';

export const useProfileFreshness = (): ProfileFreshness => useSyncExternalStore(
  profileCache.subscribeFreshness,
  profileCache.getFreshness,
  getServerSnapshot,
);
