import React, { isValidElement, useEffect, useMemo, useState } from 'react';
import { WordLength } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';
import { DictionaryPeek } from '../DictionaryPeek';

interface GameModeShellProps {
  gameId: string;
  viewerKey?: string;
  title: string;
  subtitle?: string;
  rules?: string[];
  dictionaryWords?: string[];
  dictionaryLabel?: string;
  dictionaryIcon?: string;
  wordLength?: WordLength;
  showDictionary?: boolean;
  children: React.ReactNode;
  onBackHome: () => void;
  onDictionaryPeek?: () => boolean | Promise<boolean>;
}

const hasSeenIntro = (key: string): boolean => {
  if (typeof window === 'undefined') return true;
  try { return window.localStorage.getItem(key) === 'true'; }
  catch { return true; }
};

export const GameModeShell: React.FC<GameModeShellProps> = ({ gameId, viewerKey = 'guest', title, subtitle, rules = [], dictionaryWords = [], dictionaryLabel = 'Словарь игры', dictionaryIcon = '📚', wordLength, showDictionary = true, children, onBackHome, onDictionaryPeek }) => {
  const introStorageKey = useMemo(() => `annword:game-intro:v1:${viewerKey}:${gameId}`, [gameId, viewerKey]);
  const [showRules, setShowRules] = useState(() => rules.length > 0 && !hasSeenIntro(introStorageKey));

  useEffect(() => {
    setShowRules(rules.length > 0 && !hasSeenIntro(introStorageKey));
  }, [introStorageKey, rules.length]);

  const closeRules = () => {
    try { window.localStorage.setItem(introStorageKey, 'true'); } catch { /* intro persistence must not block a game */ }
    setShowRules(false);
  };
  const child = isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ paused?: boolean }>, { paused: showRules }) : children;

  return (
    <ScreenContainer compact className="h-[100dvh] min-h-[100svh] max-w-none overflow-hidden px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-4 lg:px-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[88rem] flex-col gap-[clamp(0.4rem,1dvh,0.9rem)]">
        <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <button type="button" onClick={onBackHome} className="flex h-[clamp(2.35rem,6dvh,2.75rem)] w-[clamp(2.35rem,6dvh,2.75rem)] shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50" aria-label="Назад" title="Назад">←</button>
          <div className="min-w-0 text-center">
            {subtitle && <div className="mb-0.5 truncate text-[10px] font-black uppercase tracking-widest text-indigo-300 sm:text-xs">{subtitle}</div>}
            <h1 className="truncate text-[clamp(1.2rem,4dvh,1.875rem)] font-black leading-tight text-indigo-950">{title}</h1>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            {showDictionary && <DictionaryPeek words={dictionaryWords} wordLength={wordLength} compact label={dictionaryLabel} icon={dictionaryIcon} onBeforeOpen={onDictionaryPeek} chargeLabel="Просмотр словаря стоит как подсказка." />}
            {rules.length > 0 ? (
              <button type="button" onClick={() => setShowRules(true)} aria-label={`Правила: ${title}`} aria-expanded={showRules} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 font-black text-indigo-700 transition hover:bg-indigo-100" title="Правила режима">?</button>
            ) : null}
          </div>
        </header>

        <section className="flex min-h-0 flex-1 items-start justify-center overflow-hidden rounded-[1.5rem] border-2 border-indigo-50 bg-white/80 p-1.5 shadow-sm sm:items-center sm:rounded-[2rem] sm:p-4 lg:rounded-[2.5rem] lg:p-6">
          <div className="flex h-full min-h-0 w-full justify-center overflow-y-auto overscroll-contain pb-[max(0.25rem,env(safe-area-inset-bottom))]">{child}</div>
        </section>
      </div>

      {showRules && rules.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/55 p-3 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby={`${gameId}-intro-title`} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border-2 border-indigo-100 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Первый запуск</div><h2 id={`${gameId}-intro-title`} className="mt-1 text-2xl font-black text-indigo-950">Как играть в «{title}»</h2></div>
              <button type="button" aria-label="Закрыть правила" onClick={closeRules} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl font-black text-indigo-500">×</button>
            </div>
            <ul className="mt-5 space-y-3">{rules.map(rule => <li key={rule} className="flex gap-3 rounded-2xl bg-indigo-50/70 px-4 py-3 text-sm font-bold leading-relaxed text-indigo-950"><span aria-hidden="true" className="text-indigo-500">✓</span><span>{rule}</span></li>)}</ul>
            <button type="button" onClick={closeRules} className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white transition hover:bg-indigo-700">Начать игру</button>
            <p className="mt-3 text-center text-xs font-bold text-gray-400">Правила всегда можно открыть снова кнопкой «?».</p>
          </div>
        </div>
      )}
    </ScreenContainer>
  );
};