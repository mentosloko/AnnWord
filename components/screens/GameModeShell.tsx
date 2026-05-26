import React, { useState } from 'react';
import { ScreenContainer } from '../layout/ScreenContainer';

interface GameModeShellProps {
  title: string;
  subtitle?: string;
  rules?: string[];
  children: React.ReactNode;
  onBackHome: () => void;
}

export const GameModeShell: React.FC<GameModeShellProps> = ({ title, subtitle, rules = [], children, onBackHome }) => {
  const [showRules, setShowRules] = useState(false);

  return (
    <ScreenContainer className="pb-24">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          aria-label="Назад"
          title="Назад"
        >
          ←
        </button>
        <div className="min-w-0 text-center">
          {subtitle && <div className="mb-1 text-xs font-black uppercase tracking-widest text-indigo-300">{subtitle}</div>}
          <h1 className="truncate text-2xl font-black text-indigo-950 sm:text-3xl">{title}</h1>
        </div>
        {rules.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowRules(prev => !prev)}
            aria-label={`Правила: ${title}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 font-black text-indigo-700 transition hover:bg-indigo-100"
            title="Правила режима"
          >
            ?
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}
      </div>

      {showRules && rules.length > 0 && (
        <div className="mb-4 rounded-3xl border-2 border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
          <div className="mb-2 flex items-center justify-between gap-3 font-black">
            <span>Как играть и получать XP</span>
            <button type="button" onClick={() => setShowRules(false)} className="text-indigo-400">×</button>
          </div>
          <ul className="space-y-1 list-disc pl-5">
            {rules.map(rule => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-3 sm:p-6 overflow-x-hidden">
        {children}
      </div>
    </ScreenContainer>
  );
};