import React from 'react';

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children, className = '' }) => {
  return (
    <main className={`w-full max-w-6xl mx-auto px-4 py-6 ${className}`}>
      {children}
    </main>
  );
};
