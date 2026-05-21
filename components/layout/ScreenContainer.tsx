import React from 'react';

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children, className = '', compact = false }) => {
  const spacingClassName = compact ? '' : 'px-4 py-6';

  return (
    <main className={`w-full max-w-6xl mx-auto ${spacingClassName} ${className}`}>
      {children}
    </main>
  );
};
