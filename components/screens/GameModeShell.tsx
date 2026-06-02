import React, { useState } from 'react';
import { WordLength } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';
import { DictionaryPeek } from '../DictionaryPeek';

interface GameModeShellProps {
  title: string;
  subtitle?: string;
  rules?: string[];
  dictionaryWords?: string[];
  wordLength?: WordLength;
  children: React.ReactNode;
  onBackHome: () => void;
}

export const GameModeShell: React.FC<GameModeShellProps> = ({ title, subtitle, rules = [], dictionaryWords = [], wordLength, children, onBackHome }) => {
  const [showRules, setShowRules] = useState(false);

  return (
    <ScreenContainer compact className="h-[100dvh] max-w-none overflow-hidden px-2 py-2 sm:px-4 sm:py-4 lg:px-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[88rem] flex-col gap-2 sm:gap-3 lg:gap-4">
        <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <button
            type="button"
            onClick={onBackHome}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 sm:h-11 sm:w-11"
            aria-label="Назад"
            title="Назад"
          >
            ←
          </button>
          <div className="min-w-0 text-center">
            {subtitle && <div className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-indigo-300 sm:text-xs">{subtitle}</div>}
            <h1 className="truncate text-xl font-black text-indigo-950 sm:text-3xl">{title}</h1>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <DictionaryPeek words={dictionaryWords} wordLength={wordLength} compact />
            {rules.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowRules(prev => !prev)}
                aria-label={`Правила: ${title}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 font-black text-indigo-700 transition hover:bg-indigo-100"
                title="Правила режима"
              >
                ?
              </button>
            ) : null}
          </div>
        </header>

        {showRules && rules.length > 0 && (
          <div className="shrink-0 rounded-3xl border-2 border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-900 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3 font-black">
              <span>Как играть и получать опыт</span>
              <button type="button" onClick={() => setShowRules(false)} className="text-xl leading-none text-indigo-400">×</button>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              {rules.map(rule => <li key={rule}>{rule}</li>)}
            </ul>
          </div>
        )}

        <section className="flex min-h-0 flex-1 items-start justify-center overflow-hidden rounded-[1.5rem] border-2 border-indigo-50 bg-white/80 p-1.5 shadow-sm sm:rounded-[2rem] sm:p-5 lg:flex-none lg:items-center lg:rounded-[2.5rem] lg:p-6">
          <div className="flex h-full min-h-0 w-full justify-center overflow-hidden">
            {children}
          </div>
        </section>
      </div>
    </ScreenContainer>
  );
};