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
  const layout = KEYBOARD_LAYOUT_EN;

  const getKeyClass = (key: string) => {
    const status = letterStatuses[key];
    let base = 'h-[clamp(2rem,6.6dvh,3.25rem)] min-w-0 flex items-center justify-center rounded-lg sm:rounded-xl font-bold text-[clamp(0.68rem,2.6vw,0.95rem)] cursor-pointer select-none transition-colors active:scale-95 touch-manipulation ';
    const isControlKey = key === 'ENTER' || key === 'BACKSPACE';

    if (isControlKey) {
      base += 'flex-[1.45] px-1 ';
    } else {
      base += 'flex-1 ';
    }

    if (!isControlKey) {
      if (status === 'correct') return base + 'bg-green-500 text-white';
      if (status === 'present') return base + 'bg-yellow-500 text-white';
      if (status === 'absent') return base + 'bg-gray-500 text-white';
    } else {
      return base + 'bg-gray-300 hover:bg-gray-400 text-black';
    }

    return base + 'bg-gray-200 hover:bg-gray-300 text-black';
  };

  const renderKey = (key: string) => {
    const label = key === 'BACKSPACE' ? (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12l-2.25 2.25m-2.25-2.25l-2.25 2.25m0 0l-2.25-2.25m2.25 2.25L9.75 9.75M9.75 12l-2.25 2.25m2.25-2.25l-2.25-2.25" />
      </svg>
    ) : key === 'ENTER' ? 'ВВОД' : key;

    return (
      <button
        key={key}
        type="button"
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
    <div className="w-full max-w-[min(42rem,100vw)] px-0.5 sm:px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {layout.map((row, i) => (
        <div key={i} className="flex gap-[clamp(0.15rem,0.8vw,0.35rem)] mb-[clamp(0.15rem,0.8vw,0.4rem)] justify-center w-full px-0.5">
          {row.map(renderKey)}
        </div>
      ))}
    </div>
  );
};