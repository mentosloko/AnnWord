import React, { useMemo, useState } from 'react';
import { WordLength } from '../types';
import { PaidActionButton } from './PaidActionButton';
import { AccessibleDialog } from './a11y/AccessibleDialog';
import { IconButton } from './a11y/IconButton';
import { LiveStatus } from './a11y/LiveStatus';

interface DictionaryPeekProps {
  words?: string[];
  wordLength?: WordLength;
  compact?: boolean;
  iconOnly?: boolean;
  locked?: boolean;
  lockedMessage?: string;
  label?: string;
  icon?: string;
  emptyLabel?: string;
  onBeforeOpen?: () => boolean | Promise<boolean>;
  chargeLabel?: string;
}

export const DictionaryPeek: React.FC<DictionaryPeekProps> = ({ words = [], wordLength, compact = false, iconOnly = false, locked = false, lockedMessage = 'Мой словарь доступен после регистрации.', label = 'Мой словарь', icon = '📖', emptyLabel, onBeforeOpen, chargeLabel = 'Перед открытием будет списана 1 монета.' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [wasCharged, setWasCharged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedWords = useMemo(
    () => Array.from(new Set(words.map(word => word.trim().toUpperCase()).filter(Boolean).filter(word => wordLength === undefined || word.length === wordLength))).sort(),
    [words, wordLength],
  );
  const buttonClass = iconOnly
    ? `flex h-9 w-9 items-center justify-center rounded-xl border text-base shadow-sm transition ${locked ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-indigo-100 bg-white hover:bg-indigo-50'}`
    : compact
      ? `flex h-9 items-center rounded-xl border px-2.5 text-[11px] font-black shadow-sm ${locked ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-indigo-100 bg-white text-indigo-600'}`
      : `flex h-11 items-center rounded-2xl border-2 px-3 text-xs font-black shadow-sm transition ${locked ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50'}`;
  const open = async () => {
    setError(null);
    if (!locked && onBeforeOpen && !wasCharged) {
      const allowed = await onBeforeOpen();
      if (!allowed) { setError('Недостаточно монет для просмотра словаря.'); return; }
      setWasCharged(true);
    }
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  return (
    <>
      {onBeforeOpen && !locked && !iconOnly ? <PaidActionButton label={`${icon} ${label}`} price={1} paid={wasCharged} compact={compact} onClick={() => void open()} /> : <button type="button" onClick={() => void open()} aria-label={locked ? lockedMessage : `Открыть словарь: ${label}${onBeforeOpen && !wasCharged ? '. Стоимость 1 монета' : ''}`} className={buttonClass} title={locked ? lockedMessage : `Открыть словарь: ${label}`}>
        {iconOnly ? (locked ? '🔒' : icon) : locked ? `🔒 ${label}` : `${icon} ${label}`}
      </button>}
      {error && <LiveStatus urgent className="fixed right-3 top-20 z-[95] rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-lg">{error}</LiveStatus>}
      <AccessibleDialog open={isOpen} titleId="dictionary-peek-title" descriptionId="dictionary-peek-description" onEscape={close} overlayClassName="z-[90] bg-indigo-950/45 p-3 sm:p-6" className="flex h-[min(88dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border-2 border-indigo-100 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-indigo-50 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Во время игры</div>
            <h2 id="dictionary-peek-title" className="text-2xl font-black text-indigo-950 sm:text-3xl">{label}</h2>
            <p id="dictionary-peek-description" className="mt-1 text-sm font-bold text-gray-500">
              {locked ? 'Доступно после регистрации' : <>{wordLength ? `Слова из ${wordLength} букв · ` : ''}{normalizedWords.length} слов</>}
            </p>
            {!locked && onBeforeOpen && <p className="mt-1 text-xs font-bold text-amber-600">{wasCharged ? 'Просмотр словаря оплачен для этой игры.' : chargeLabel}</p>}
          </div>
          <IconButton label="Закрыть словарь" onClick={close} className="flex h-11 w-11 shrink-0 rounded-2xl bg-indigo-50 text-2xl font-black text-indigo-600">×</IconButton>
        </header>
        {locked ? (
          <div className="m-6 rounded-2xl bg-indigo-50 p-6 text-center">
            <div className="text-4xl">🔒</div>
            <h3 className="mt-3 text-xl font-black text-indigo-950">Зарегистрируйтесь в Kids или Practice</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed text-gray-600">{lockedMessage}</p>
          </div>
        ) : normalizedWords.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {normalizedWords.map((word, index) => <div key={word} className="flex min-h-12 items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"><span className="w-8 shrink-0 text-right text-xs font-black text-indigo-300">{index + 1}</span><span className="break-all text-base font-black tracking-wide text-indigo-900 sm:text-lg">{word}</span></div>)}
            </div>
          </div>
        ) : (
          <div className="m-6 rounded-2xl bg-gray-50 p-6 text-center text-base font-bold text-gray-500">
            {emptyLabel || (wordLength ? `В словаре «${label}» нет слов из ${wordLength} букв.` : `Словарь «${label}» пока пуст.`)}
          </div>
        )}
      </AccessibleDialog>
    </>
  );
};