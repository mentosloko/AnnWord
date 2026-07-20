import React from 'react';

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const toneClasses: Record<NoticeTone, string> = {
  info: 'border-indigo-100 bg-indigo-50 text-indigo-800',
  success: 'border-green-100 bg-green-50 text-green-800',
  warning: 'border-amber-100 bg-amber-50 text-amber-800',
  error: 'border-rose-100 bg-rose-50 text-rose-700',
};

interface StatusMessageProps {
  message?: string | null;
  tone?: NoticeTone;
  role?: 'status' | 'alert';
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const FloatingNotice: React.FC<StatusMessageProps> = ({ message, tone = 'info', role = 'status', className = '', actionLabel, onAction }) => {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 top-20 z-[65] flex justify-center sm:inset-x-auto sm:right-4 sm:justify-end">
      <div role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-bold shadow-xl ${toneClasses[tone]} ${className}`}>
        <span className="min-w-0 flex-1">{message}</span>
        {actionLabel && onAction && <button type="button" onClick={onAction} className="shrink-0 rounded-xl bg-white/80 px-3 py-2 text-xs font-black shadow-sm">{actionLabel}</button>}
      </div>
    </div>
  );
};

interface StableStatusSlotProps extends StatusMessageProps {
  minHeightClassName?: string;
}

export const StableStatusSlot: React.FC<StableStatusSlotProps> = ({ message, tone = 'info', role = 'status', className = '', minHeightClassName = 'min-h-[3.5rem]' }) => (
  <div className={`flex items-start ${minHeightClassName}`}>
    {message ? <div role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} className={`w-full rounded-2xl border px-3 py-2 text-sm font-bold leading-relaxed ${toneClasses[tone]} ${className}`}>{message}</div> : null}
  </div>
);
