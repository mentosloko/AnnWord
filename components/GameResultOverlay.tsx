import React, { useEffect, useRef } from 'react';
import { PetState } from '../types';
import { getCharacterStageLabel } from '../services/gamificationRules';

type GameResultOverlayProps = {
  isOpen?: boolean;
  status?: 'won' | 'lost' | 'completed';
  title: string;
  subtitle?: string;
  details?: React.ReactNode;
  emoji?: string;
  pet?: PetState;
  xpGained?: number;
  coinsGained?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

export const GameResultOverlay: React.FC<GameResultOverlayProps> = ({
  isOpen = false,
  status = 'completed',
  title,
  subtitle,
  details,
  emoji = '🎉',
  pet,
  xpGained = 0,
  coinsGained = 0,
  primaryLabel = 'Играть снова',
  secondaryLabel = 'В меню',
  onPrimary,
  onSecondary,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onSecondary) onSecondary();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onSecondary]);

  if (!isOpen) return null;

  const statusTone = status === 'won' ? 'text-green-600 bg-green-50 border-green-100' : status === 'lost' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100';
  const safeXp = Math.max(0, xpGained);
  const safeCoins = Math.max(0, coinsGained);
  const hasXp = safeXp > 0;
  const hasCoins = safeCoins > 0;
  const rewardGridClass = hasXp && hasCoins ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/55 p-4 backdrop-blur-sm" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
        aria-labelledby="game-result-title"
        aria-describedby={subtitle ? 'game-result-subtitle' : undefined}
        tabIndex={-1}
        className="w-full max-w-md rounded-[2rem] border-2 border-indigo-100 bg-white p-5 text-center shadow-2xl outline-none sm:p-6"
      >
        <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border text-4xl ${statusTone}`} aria-hidden="true">
          {emoji}
        </div>
        <h2 id="game-result-title" className="text-3xl font-black text-indigo-950">{title}</h2>
        {subtitle && <p id="game-result-subtitle" className="mt-2 text-sm font-bold leading-relaxed text-gray-600">{subtitle}</p>}
        {details && <div className="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-900">{details}</div>}
        {(hasXp || hasCoins) && (
          <div className={`mt-4 grid ${rewardGridClass} gap-2`}>
            {hasXp && (
              <div className="rounded-2xl border border-purple-100 bg-purple-50 p-3">
                <div className="text-2xl font-black text-purple-700">+{safeXp}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-purple-400">опыт</div>
              </div>
            )}
            {hasCoins && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-2xl font-black text-amber-700">+{safeCoins}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-500">монеты</div>
              </div>
            )}
          </div>
        )}
        {pet && (
          <div className="mt-4 rounded-2xl border border-indigo-50 bg-white px-4 py-3 text-left shadow-sm">
            <div className="text-xs font-black uppercase tracking-widest text-indigo-300">Прогресс персонажа</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="font-black text-indigo-950">{pet.name}</div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600">ур. {pet.level}</div>
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">{getCharacterStageLabel(pet.stage)} · {pet.xp} XP</div>
          </div>
        )}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onPrimary} className="rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
            {primaryLabel}
          </button>
          {onSecondary && (
            <button type="button" onClick={onSecondary} className="rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3 font-black text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
