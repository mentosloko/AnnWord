import React, { useState } from 'react';
import { ScreenContainer } from '../layout/ScreenContainer';
import { ChildSetupResult } from '../../services/familyAccountService';

interface Props {
  onCreateChild: (childName: string, pin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

export const FamilySetupScreen: React.FC<Props> = ({ onCreateChild, onComplete, onBackHome }) => {
