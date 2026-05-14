import React from 'react';
import { forceHomeNavigation } from '../utils/navigationBridge';

interface ScreenFallbackHomeButtonProps {
  label?: string;
  className?: string;
}

export const ScreenFallbackHomeButton: React.FC<ScreenFallbackHomeButtonProps> = ({
  label = '← На главный экран',
  className = 'px-4 py-2 rounded-xl bg-white border-2 border-indigo-100 text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-sm',
}) => {
  return (
    <button
      type="button"
      onClick={forceHomeNavigation}
      className={className}
    >
      {label}
    </button>
  );
};

export default ScreenFallbackHomeButton;
