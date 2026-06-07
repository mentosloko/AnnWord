import React from 'react';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';
interface ProfileScreenProps{userProfile:UserProfile;isAuthenticated:boolean;onBackHome:()=>void;onOpenShop:()=>void;onOpenPetRoom:()=>void;onLogin:()=>void}
export const ProfileScreen:React.FC<ProfileScreenProps>=({userProfile,isAuthenticated,onBackHome,onOpenShop,onOpenPetRoom,on