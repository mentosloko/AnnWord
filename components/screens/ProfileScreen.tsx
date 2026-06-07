import React from 'react';
import { UserProfile } from '../../types';
interface P{userProfile:UserProfile;isAuthenticated:boolean;onBackHome:()=>void;onOpenShop:()=>void;onOpenPetRoom:()=>void;onLogin:()=>void}
export const ProfileScreen:React.FC<P>=p=><div><button onClick={p.onBackHome}>Back</button><div>{p.userProfile.username}</div></div>;
