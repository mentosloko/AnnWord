import React from 'react';

interface PaidActionButtonProps {
  label: string;
  price?: number;
  disabled?: boolean;
  loading?: boolean;
  paid?: boolean;
  compact?: boolean;
  className?: string;
  onClick: () => void;
}

export const PaidActionButton: React.FC<PaidActionButtonProps> = ({ label, price = 1, disabled = false, loading = false, paid = false, compact = false, className = '', onClick }) => {
  const priceText = paid ? 'оплачено' : `${price}★`;
  const disabledText = disabled && !paid ? `Нужно ${price}★` : priceText;
  return <button
    type="button"
    disabled={disabled || loading || paid}
    onClick={onClick}
    aria-label={`${label}. ${paid ? 'Уже оплачено' : `Стоимость ${price} монета`}`}
    className={`${compact ? 'rounded-xl px-2.5 py-2 text-[0.72rem]' : 'rounded-2xl px-4 py-3 text-sm'} inline-flex items-center justify-center gap-2 border-2 font-black shadow-sm transition ${disabled && !paid ? 'border-gray-100 bg-gray-50 text-gray-400' : paid ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-800 hover:-translate-y-0.5 hover:bg-amber-100'} ${className}`}
  >
    <span>{loading ? '...' : label}</span>
    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.68rem] font-black">{disabledText}</span>
  </button>;
};