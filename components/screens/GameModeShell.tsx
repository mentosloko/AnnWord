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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={onBackHome}
          className="w-fit rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
        >
          ← На главный экран
        </button>
        <div className="sm:text-right flex sm:items-end gap-3 sm:justify-end">
          <div>
            {subtitle && <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">{subtitle}</div>}
            <h1 className="text-3xl font-black text-indigo-950">{title}</h1>
          </div>
          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRules(prev => !prev)}
              aria-label={`Правила: ${title}`}
              className="h-10 w-10 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-black hover:bg-indigo-100 transition"
              title="Правила режима"
            >
              ?
            </button>
          )}
        </div>
      </div>

      {showRules && rules.length > 0 && (
        <div className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
          <div className="font-black mb-2">Как играть и получать XP</div>
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