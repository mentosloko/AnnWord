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
    <ScreenContainer className="min-h-[100dvh] py-2 pb-2 sm:py-4 sm:pb-4">
      <div className="flex min-h-[calc(100dvh-1rem)] sm:min-h-[calc(100dvh-2rem)] flex-col gap-2 sm:gap-4">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackHome}
            className="rounded-xl bg-white border-2 border-indigo-100 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-base font-bold text-indigo-700 hover:bg-indigo-50 transition"
          >
            ← Главная
          </button>
          <div className="min-w-0 text-center">
            {subtitle && <div className="hidden sm:block text-xs font-black text-indigo-300 uppercase tracking-widest">{subtitle}</div>}
            <h1 className="text-base sm:text-3xl font-black text-indigo-950 truncate">{title}</h1>
          </div>
          {rules.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowRules(prev => !prev)}
              aria-label={`Правила: ${title}`}
              className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-black hover:bg-indigo-100 transition"
              title="Правила режима"
            >
              ?
            </button>
          ) : (
            <div className="h-8 w-8 sm:h-10 sm:w-10" />
          )}
        </div>

        {showRules && rules.length > 0 && (
          <div className="shrink-0 rounded-2xl sm:rounded-3xl border-2 border-indigo-100 bg-indigo-50 px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-indigo-900">
            <div className="font-black mb-1 sm:mb-2">Как играть</div>
            <ul className="space-y-0.5 sm:space-y-1 list-disc pl-5">
              {rules.map(rule => <li key={rule}>{rule}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-1 min-h-0 items-stretch justify-center rounded-[1.5rem] sm:rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-2 sm:p-4 overflow-hidden">
          {children}
        </div>
      </div>
    </ScreenContainer>
  );
};