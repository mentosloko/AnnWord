import React from 'react';
import { ScreenContainer } from '../layout/ScreenContainer';

export const FamilySetupScreen: React.FC<any> = ({ onBackHome }) => {
  return (
    <ScreenContainer className="max-w-lg pb-20">
      <button type="button" onClick={onBackHome}>Back</button>
      <section>
        <h1>Setup</h1>
        <p>V1 account setup screen.</p>
      </section>
    </ScreenContainer>
  );
};
