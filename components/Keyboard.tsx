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

  const getKeyClass = (key: string, rowIndex: number) => {
    const status = letterStatuses[key];
    let base = "h-12 sm:h-14 flex items-center justify-center rounded font-bold text-sm cursor-pointer select-none transition-colors active:scale-95 ";
    
    const isControlKey = key === 'ENTER' || key === 'BACKSPACE';

    // Width adjustments
    if (isControlKey) {
      // Make control keys significantly wider (1.5x a standard key)
      base += "flex-[1.5] text-xs sm:text-sm px-1 "; 
    } else {
      // Standard letters share equal width
      base += "flex-1 ";
    }

    // Color based on status
    if (!isControlKey) {
      if (status === 'correct') return base + "bg-green-500 text-white";
      if (status === 'present') return base + "bg-yellow-500 text-white";
      if (status === 'absent') return base + "bg-gray-500 text-white";
    } else {
      // Control keys color
      return base + "bg-gray-300 hover:bg-gray-400 text-black";
    }
    
    return base + "bg-gray-200 hover:bg-gray-300 text-black";
  };

  const renderKey = (key: string, rowIndex: number) => {
    const label = key === 'BACKSPACE' ? (
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12l-2.25 2.25m-2.25-2.25l-2.25 2.25m0 0l-2.25-2.25m2.25 2.25L9.75 9.75M9.75 12l-2.25 2.25m2.25-2.25l-2.25-2.25" />
      </svg>
    ) : key === 'ENTER' ? 'ВВОД' : key;

    return (
      <button
        key={key}
        className={getKeyClass(key, rowIndex)}
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
    <div className="w-full max-w-3xl px-1 pb-4">
      {layout.map((row, i) => (
        <div key={i} className="flex gap-1 mb-1.5 justify-center w-full px-1">
          {row.map(k => renderKey(k, i))}
        </div>
      ))}
    </div>
  );
};