import React from 'react';
import App from './AppV2';
import { PasswordResetOverlay } from './components/auth/PasswordResetOverlay';

const AppRuntime: React.FC = () => (
  <>
    <App />
    <PasswordResetOverlay />
  </>
);

export default AppRuntime;
