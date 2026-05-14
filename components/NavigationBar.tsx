import React from 'react';
import { AppScreen } from '../services/navigation';

interface NavigationBarProps {
  currentScreen: AppScreen;
  canGoBack: boolean;
  onHome: () => void;
  onBack: () => void;
  title?: string;
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  borderRadius: 12,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 600,
  backdropFilter: 'blur(10px)',
};

export const NavigationBar: React.FC<NavigationBarProps> = ({
  currentScreen,
  canGoBack,
  onHome,
  onBack,
  title,
}) => {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onHome}
          style={buttonStyle}
          aria-label="Go home"
        >
          Home
        </button>

        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            style={buttonStyle}
            aria-label="Go back"
          >
            Back
          </button>
        )}
      </div>

      <div
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 14,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {title || currentScreen}
      </div>
    </div>
  );
};

export default NavigationBar;
