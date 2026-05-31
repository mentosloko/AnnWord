import React, { useMemo, useState } from 'react';

interface DictionaryPeekProps {
  words?: string[];
  compact?: boolean;
}

export const DictionaryPeek: React.FC<DictionaryPeekProps> = ({ words = [], compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedWords = useMemo(() => Array.from(new Set(words.map(word => word.trim().toUpperCase()).filter(Boolean))).sort(), [words]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={compact
          ? 'flex h-9 items-center rounded-xl border border-indigo-100 bg-white px-2.5 text-[11px] font-black text-indigo-600 shadow-sm'
          : 'flex h-11 items-center rounded-2xl border-2 border-indigo-100 bg-white px-3 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50'}
        title="Открыть мой словарь"
      >
        📖 Мой словарь
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-indigo-950/45 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="flex max-h-[84dvh] w-full max-w-md flex-col rounded-[2rem] border-2 border-indigo-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Во время игры</div>
                <h2 className="text-2xl font-black text-indigo-950">Мой словарь</h2>
                <p className="mt-1 text-sm font-bold text-gray-500">{normalizedWords.length} слов</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl font-black text-indigo-600">×</button>
            </div>
            {normalizedWords.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {normalizedWords.map(word => <div key={word} className="truncate rounded-xl bg-indigo-50 px-3 py-2 text-center text-sm font-black text-indigo-800">{word}</div>)}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-center text-sm font-bold text-gray-500">Личный словарь пока не загружен.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
