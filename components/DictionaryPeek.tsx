import React, { useMemo, useState } from 'react';
import { WordLength } from '../types';

interface DictionaryPeekProps {
  words?: string[];
  wordLength?: WordLength;
  compact?: boolean;
  iconOnly?: boolean;
}

export const DictionaryPeek: React.FC<DictionaryPeekProps> = ({ words = [], wordLength, compact = false, iconOnly = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedWords = useMemo(
    () => Array.from(new Set(
      words
        .map(word => word.trim().toUpperCase())
        .filter(Boolean)
        .filter(word => wordLength === undefined || word.length === wordLength),
    )).sort(),
    [words, wordLength],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Открыть мой словарь"
        className={iconOnly
          ? 'flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-white text-base shadow-sm transition hover:bg-indigo-50'
          : compact
            ? 'flex h-9 items-center rounded-xl border border-indigo-100 bg-white px-2.5 text-[11px] font-black text-indigo-600 shadow-sm'
            : 'flex h-11 items-center rounded-2xl border-2 border-indigo-100 bg-white px-3 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50'}
        title="Открыть мой словарь"
      >
        {iconOnly ? '📖' : '📖 Мой словарь'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-indigo-950/45 p-3 backdrop-blur-sm sm:p-6">
          <div role="dialog" aria-modal="true" aria-label="Мой словарь" className="flex h-[min(88dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border-2 border-indigo-100 bg-white shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-indigo-50 px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Во время игры</div>
                <h2 className="text-2xl font-black text-indigo-950 sm:text-3xl">Мой словарь</h2>
                <p className="mt-1 text-sm font-bold text-gray-500">
                  {wordLength ? `Слова из ${wordLength} букв · ` : ''}{normalizedWords.length} слов
                </p>
              </div>
              <button type="button" aria-label="Закрыть словарь" onClick={() => setIsOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-2xl font-black text-indigo-600">×</button>
            </header>

            {normalizedWords.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {normalizedWords.map((word, index) => (
                    <div key={word} className="flex min-h-12 items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                      <span className="w-8 shrink-0 text-right text-xs font-black text-indigo-300">{index + 1}</span>
                      <span className="break-all text-base font-black tracking-wide text-indigo-900 sm:text-lg">{word}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="m-6 rounded-2xl bg-gray-50 p-6 text-center text-base font-bold text-gray-500">
                {wordLength ? `В личном словаре нет слов из ${wordLength} букв.` : 'Личный словарь пока не загружен.'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
