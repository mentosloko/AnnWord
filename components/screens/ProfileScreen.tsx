import React from 'react';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';
interface P{userProfile:UserProfile;isAuthenticated:boolean;onBackHome:()=>void;onOpenShop:()=>void;onOpenPetRoom:()=>void;onLogin:()=>void}
export const ProfileScreen:React.FC<P>=({userProfile,isAuthenticated,onBackHome,onOpenShop,onOpenPetRoom,onLogin})=>{const kids=user