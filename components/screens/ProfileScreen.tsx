import React from 'react';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ProfileScreenProps { userProfile: UserProfile; isAuthenticated: boolean; onBackHome: () => void; onOpenShop: () => void; onOpenPetRoom: () => void; onLogin: () => void; }

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ userProfile, isAuthenticated, onBackHome, onOpenShop, onOpenPetRoom, onLogin }) => {
  const isKids = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const winRate = userProfile.stats.gamesPlayed > 0 ? Math.round((userProfile.stats.gamesWon / userProfile.stats.gamesPlayed) * 100) : 0;
  if (!isAuthenticated) return <ScreenContainer className="max-w-2xl pb-24"><button type="button" onClick={onBackHome} className="mb-5 rounded-xl border-2 border-indigo-100 bg-white px-4 py-2 font-bold text-indigo-700">Back</button><section className="rounded-[2rem