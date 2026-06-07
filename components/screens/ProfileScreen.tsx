import React from 'react';
import { UserProfile } from '../../types';
import { getPetEmoji } from '../../services/petEngine';
import { getPetCharacterAssetUrl } from '../../services/petAssets';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ProfileScreenProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onBackHome: () => void;
  onOpenShop: () => void;
  onOpenPetRoom: () => void;
  onLogin: () => void;
}

const t = {
  back: '\u