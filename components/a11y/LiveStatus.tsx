import React from 'react';

interface LiveStatusProps {
  children: React.ReactNode;
  urgent?: boolean;
  className?: string;
}

export const LiveStatus: React.FC<LiveStatusProps> = ({ children, urgent = false, className = '' }) => (
  <div role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} className={className}>
    {children}
  </div>
);