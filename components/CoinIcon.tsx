import React from 'react';

interface CoinIconProps {
  className?: string;
  label?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({ className = '', label = 'монеты' }) => (
  <span
    role="img"
    aria-label={label}
    className={`inline-flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center rounded-full border-2 border-yellow-300 bg-yellow-400 align-[-0.12em] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)] ${className}`}
  >
    <span className="h-[0.42em] w-[0.42em] rounded-full bg-yellow-200/85" aria-hidden="true" />
  </span>
);
