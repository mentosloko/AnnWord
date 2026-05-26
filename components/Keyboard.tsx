import React from 'react';
import { KEYBOARD_LAYOUT_EN } from '../constants';
import { CharStatus } from '../types';

interface KeyboardProps {
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  letterStatuses: Record<string, CharStatus>;
}

export const Keyboard: React.FC<KeyboardProps> = ({ onChar, onDelete, onEnter, letterStatuses }) => {
  const getKeyClass = (key: string) => {
    const status = letterStatuses[key];
    const isControlKey = key === 'ENTER' || key === 'BACKSPACE';
    let base = 'min-w-0 flex items-center justify-center rounded-xl sm:rounded-2xl font-black cursor-pointer select-none transition-colors active:scale-95 touch-manipulation shadow-sm border-2 ';

    if (isControlKey) {
      base += 'h-[clamp(2.3rem,6.2dvh,3.25rem)] sm:h-[clamp(2.2rem,5.8dvh,3.1rem)] flex-[1.45] px-1 text-[clamp(0.74rem,2.55vw,0.98rem)] ';
      return base + 'bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-indigo-200';
    }

    base += 'h-[clamp(2.3rem,6.2dvh,3.25rem)] sm:h-[clamp(2.2rem,5.8dvh,3.1rem)] flex-1 text-[clamp(0.92rem,3vw,1.12rem)] ';

    if (status === 'correct') return base + 'bg-green-500 text-white border-green-500';
    if (status === 'present') return base + 'bg-yellow-500 text-white border-yellow-500';
    if (status === 'absent') return base + 'bg-gray-400 text-white border-gray-400';
    return base + 'bg-white hover:bg-indigo-50 text-indigo-950 border-indigo-100';
  };

  const renderKey = (key: string) => {
    const label = key === 'BACKSPACE' ? '⌫' : key === 'ENTER' ? 'ВВОД' : key;

    return (
      <button
        key={key}
        type="button"
        aria-label={key === 'BACKSPACE' ? 'Удалить букву' : key === 'ENTER' ? 'Проверить слово' : `Буква ${key}`}
        className={getKeyClass(key)}
        onClick={() => {
          if (key === 'ENTER') onEnter();
          else if (key === 'BACKSPACE') onDelete();
          else onChar(key);
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[min(100%,48rem)] px-0 pb-[max(0.1rem,env(safe-area-inset-bottom))]">
      {KEYBOARD_LAYOUT_EN.map((row, i) => (
        <div
          key={i}
          className="flex gap-[clamp(0.14rem,0.55vw,0.32rem)] mb-[clamp(0.14rem,0.55vw,0.32rem)] justify-stretch w-full last:mb-0"
        >
          {row.map(renderKey)}
        </div>
      ))}
    </div>
  );
};