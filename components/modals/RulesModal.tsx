import React, { useEffect, useRef } from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="rules-modal-title" tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl outline-none animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h3 id="rules-modal-title" className="text-2xl font-black text-indigo-900">Правила AnnWord</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть правила" className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl text-gray-400 hover:bg-gray-50 hover:text-gray-600">×</button>
        </div>

        <div className="space-y-5 text-gray-700">
          <section>
            <h4 className="mb-2 font-black text-indigo-800">Цель игры</h4>
            <p className="text-sm leading-relaxed">Угадайте английское слово за ограниченное число попыток. После каждой попытки игра показывает, какие буквы стоят на правильном месте, какие есть в слове, а каких в слове нет.</p>
          </section>
          <section className="grid gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500 font-black text-white">A</div><div><div className="font-bold text-green-800">Зелёный</div><div className="text-xs text-green-700">Буква есть в слове и стоит на правильном месте.</div></div></div>
            <div className="flex items-center gap-3 rounded-2xl border border-yellow-100 bg-yellow-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500 font-black text-white">B</div><div><div className="font-bold text-yellow-800">Жёлтый</div><div className="text-xs text-yellow-700">Буква есть в слове, но стоит в другом месте.</div></div></div>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-400 font-black text-white">C</div><div><div className="font-bold text-gray-800">Серый</div><div className="text-xs text-gray-600">Такой буквы в слове нет.</div></div></div>
          </section>
          <section>
            <h4 className="mb-2 font-black text-indigo-800">Словарь</h4>
            <p className="text-sm leading-relaxed">Играйте со встроенным словарём или загрузите свои слова, чтобы потренировать их во всех режимах.</p>
          </section>
        </div>

        <button type="button" onClick={onClose} className="mt-7 w-full rounded-2xl bg-indigo-600 py-3 font-black text-white transition hover:bg-indigo-700">Понятно</button>
      </div>
    </div>
  );
};
