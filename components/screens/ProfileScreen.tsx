import React from 'react';
import { UserProfile } from '../../types';
import { getCharacterProgressPercent, getCharacterProgressText, getCharacterStageLabel, normalizeMoodScore } from '../../services/gamificationRules';
import { getPetEmoji, getPetNeedSnapshot } from '../../services/petEngine';
import { getPetCharacterAssetUrl } from '../../services/petAssets';
import { ScreenContainer } from '../layout/ScreenContainer';
import { CoinIcon } from '../CoinIcon';

interface ProfileScreenProps