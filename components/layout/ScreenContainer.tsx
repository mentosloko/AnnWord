import React from 'react';

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  id?: string;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children, className = '', compact = false, id = 'main-content' }) => {
  const spacingClassName = compact ? '' : 'px-4 py-6';

  return (
    <main id={id} tabIndex={-1} className={`w-full max-w-6xl mx-auto ${spacingClassName} ${className}`}>
      {children}
    </main>
  );
};
