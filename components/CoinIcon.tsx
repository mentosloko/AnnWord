import React from 'react';

interface CoinIconProps {
  className?: string;
  label?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({ className = '', label = 'монеты' }) => (
  <span
    role="img"
    aria-label={label}
    className={`inline-flex h-[1.15em] min-w-[1.15em] shrink-0 items-center justify-center rounded-full border-2 border-yellow-300 bg-yellow-400 px-[0.18em] align-[-0.12em] text-[0.64em] font-black leading-none text-yellow-900 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)] ${className}`}
  >
    ★
  </span>
);