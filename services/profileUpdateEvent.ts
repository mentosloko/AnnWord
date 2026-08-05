import type { UserProfile } from '../types';
import { profileCache } from './profileCache';

export interface OwnedProfileUpdateEvent {
  userId: string;
  profile: UserProfile;
}

export const getCurrentProfileOwnerId = (): string | null => profileCache.readSnapshot()?.userId || null;

export const dispatchOwnedProfileUpdate = (userId: string | null, profile: UserProfile): boolean => {
  if (typeof window === 'undefined' || !userId || getCurrentProfileOwnerId() !== userId) return false;
  window.dispatchEvent(new CustomEvent<OwnedProfileUpdateEvent>('annword:profile-updated', { detail: { userId, profile } }));
  return true;
};

export const readOwnedProfileUpdateEvent = (value: unknown): OwnedProfileUpdateEvent | null => {
  if (!value || typeof value !== 'object') return null;
  const detail = value as Partial<OwnedProfileUpdateEvent>;
  if (typeof detail.userId !== 'string' || !detail.userId || !detail.profile || typeof detail.profile !== 'object') return null;
  return { userId: detail.userId, profile: detail.profile as UserProfile };
};
