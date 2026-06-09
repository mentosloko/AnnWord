import React, { useState } from 'react';
import { ChildSetupResult } from '../../services/familyAccountService';
import { ScreenContainer } from '../layout/ScreenContainer';

interface FamilySetupScreenProps {
  onCreateChild: (childName: string, parentPin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

export const FamilySetupScreen