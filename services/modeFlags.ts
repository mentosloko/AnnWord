import { UserProfile } from '../types';

export const isPracticeMode = (profile: Pick<UserProfile, 'role' | 'accountMode'>, isAuthenticated = true): boolean =>
  isAuthenticated && profile.role !== 'admin' && profile.role !== 'teacher' && profile.role !== 'parent' && profile.accountMode === 'player';

export const isKidsMode = (profile: Pick<UserProfile, 'role' | 'accountMode'>, isAuthenticated = true): boolean =>
  isAuthenticated && (profile.role === 'parent' || profile.accountMode === 'parent');

export const isTeacherMode = (profile: Pick<UserProfile, 'role' | 'accountMode'>, isAuthenticated = true): boolean =>
  isAuthenticated && (profile.role === 'teacher' || profile.accountMode === 'teacher');
