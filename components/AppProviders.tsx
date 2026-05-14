import React from 'react';
import { AuthProvider } from '../providers/AuthProvider';
import { NavigationProvider } from '../providers/NavigationProvider';
import { ProfileProvider } from '../providers/ProfileProvider';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <ProfileProvider>
      <NavigationProvider>
        {children}
      </NavigationProvider>
    </ProfileProvider>
  </AuthProvider>
);
