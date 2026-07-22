import React, { useEffect, useState } from 'react';
import { wordTranslationService } from '../services/wordTranslationService';

interface ReviewWordListProps {
  words: string[];
  limit?: number;
  className?: string;
}

interface TranslationState {
  word: string;
  translation: string | null;
  loading: boolean;
  failed: boolean;
}

export const ReviewWordList: React.FC<ReviewWordListProps> = ({ words, limit = 40, className = '' }) => {
  const [selected, setSelected] = useState<TranslationState | null>(null);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [selected]);

  const openTranslation = async (word: string) => {
    setSelected({ word, translation: null, loading: true, failed: false });
    try {
      const translation = await wordTranslationService.get(word);
      setSelected(current => current?.word === word ? { word, translation, loading: false, failed: false } : current);
    } catch {
      setSelected(current => current?.word === word ? { word, translation: null, loading: false, failed: true } : current);
    }
  };

  return <>
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {words.slice(0, limit).map(word => <button key={word} type="button" aria-haspopup="dialog" aria-label={`Показать перевод слова ${word}`} onClick={() => void openTranslation(word)} className="rounded-full bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100">{word}</button>)}
    </div>
    {selected && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-indigo-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setSelected(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="review-word-title" aria-describedby="review-word-translation" className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">Перевод</div>
        <h2 id="review-word-title" className="mt-2 text-3xl font-bold text-indigo-950">{selected.word}</h2>
        <div id="review-word-translation" role="status" aria-live="polite" className="mt-4 rounded-2xl bg-indigo-50 px-4 py-5 text-xl font-bold text-indigo-800">
          {selected.loading ? 'Ищу перевод…' : selected.translation || (selected.failed ? 'Не удалось загрузить перевод.' : 'Перевод пока не найден.')}
        </div>
        <button type="button" autoFocus onClick={() => setSelected(null)} className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white">Закрыть</button>
      </div>
    </div>}
  </>;
};
