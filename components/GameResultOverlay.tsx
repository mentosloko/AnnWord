import React from 'react';
import { motion } from 'motion/react';
import { PetState } from '../types';
import { CharacterProgressCard } from './CharacterProgressCard';
import { normalizeMoodScore } from '../services/gamificationRules';

interface GameResultOverlayProps {
  isOpen: boolean;
  status: 'won' | 'lost' | 'completed';
  title: string;
  subtitle?: string;
  emoji?: string;
  pet: PetState;
  xpGained: number;
  coinsG