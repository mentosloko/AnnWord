import React from 'react';
import { WordLength, CharStatus } from '../types';

interface GridProps {
  guesses: string[];
  currentGuess: string;
  secretWord: string;
  wordLength: WordLength;
  maxGuesses: number;
  shakeRowIndex?: number | null;
}

const getCellSize = (wordLength: WordLength): string => {
  const horizontalGap = wordLength === 6 ? '0.28rem' : '0.34rem';
  const maxSize = wordLength === 6 ? '4.45rem' : '4.85rem';
  return `min(calc((100vw - 1.1rem - (${wordLength - 1} * ${horizontalGap})) / ${wordLength}), calc((100dvh - 10.25rem) / 6), ${maxSize})`;
};

const statusText = (status: CharStatus): string => {
  if (status === 'correct') return 'буква на правильном месте';
  if (status === 'present') return 'буква есть в слове, но в другом месте';
  if (status === 'absent') return 'буквы нет в слове';
  return 'пока без проверки';
};

const Cell: React.FC<{ letter: string; status: CharStatus; wordLength: WordLength; row: number; column: number }> = ({ letter, status, wordLength, row, column }) => {
  const baseClasses = 'shrink-0 min-w-0 border-2 flex items-center justify-center text-[clamp(1rem,4.8vw,2rem)] font-black uppercase select-none transition-all duration-300 rounded-xl sm:rounded-2xl tracking-[0.06em] font-mono leading-none';
  let statusClasses = '';

  switch (status) {
    case 'correct':
      statusClasses = 'bg-green-500 border-green-500 text-white';
      break;
    case 'present':
      statusClasses = 'bg-yellow-500 border-yellow-500 text-white';
      break;
    case 'absent':
      statusClasses = 'bg-gray-500 border-gray-500 text-white';
      break;
    default:
      statusClasses = letter ? 'border-gray-400 text-indigo-950 scale-105 bg-white' : 'border-gray-200 bg-white';
      break;
  }

  const size = getCellSize(wordLength);
  const ariaLabel = `Попытка ${row + 1}, буква ${column + 1}: ${letter || 'пусто'}, ${statusText(status)}`;
  return <div role="gridcell" aria-label={ariaLabel} className={`${baseClasses} ${statusClasses}`} style={{ width: size, height: size }}>{letter}</div>;
};

export const Grid: React.FC<GridProps> = ({ guesses, currentGuess, secretWord, wordLength, maxGuesses, shakeRowIndex }) => {
  const getRowStatuses = (guess: string): CharStatus[] => {
    const statuses: CharStatus[] = Array(wordLength).fill('absent');
    const secretArr = secretWord.split('');
    const guessArr = guess.split('');

    guessArr.forEach((char, i) => {
      if (char === secretArr[i]) {
        statuses[i] = 'correct';
        secretArr[i] = '#';
      }
    });

    guessArr.forEach((char, i) => {
      if (statuses[i] !== 'correct') {
        const indexInSecret = secretArr.indexOf(char);
        if (indexInSecret !== -1) {
          statuses[i] = 'present';
          secretArr[indexInSecret] = '#';
        }
      }
    });

    return statuses;
  };

  const rows = [];
  for (let i = 0; i < maxGuesses; i++) {
    let rowContent;
    const isShake = i === shakeRowIndex;

    if (i < guesses.length) {
      const guess = guesses[i];
      const statuses = getRowStatuses(guess);
      rowContent = guess.split('').map((letter, idx) => <Cell key={idx} letter={letter} status={statuses[idx]} wordLength={wordLength} row={i} column={idx} />);
    } else if (i === guesses.length) {
      const chars = currentGuess.split('');
      rowContent = Array.from({ length: wordLength }).map((_, idx) => <Cell key={idx} letter={chars[idx] || ''} status="initial" wordLength={wordLength} row={i} column={idx} />);
    } else {
      rowContent = Array.from({ length: wordLength }).map((_, idx) => <Cell key={idx} letter="" status="initial" wordLength={wordLength} row={i} column={idx} />);
    }

    rows.push(
      <div key={i} role="row" aria-label={`Попытка ${i + 1}`} className={`flex w-full justify-center gap-[min(1.1vw,0.34rem)] ${isShake ? 'animate-shake' : ''}`} style={{ animation: isShake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}>
        {rowContent}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
      <div role="grid" aria-label="Поле игры Классика" className="flex h-full w-full max-w-[min(42rem,100vw)] flex-col items-center justify-center gap-[min(0.5dvh,0.32rem)] p-0.5">
        {rows}
      </div>
    </>
  );
};