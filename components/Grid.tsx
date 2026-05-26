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

const getCellSizeClass = (wordLength: WordLength): string => {
  if (wordLength === 6) return 'w-[clamp(2.45rem,12.2vw,4.55rem)] md:w-[clamp(3.2rem,8.4vw,4.95rem)]';
  if (wordLength === 4) return 'w-[clamp(2.95rem,16vw,5.2rem)] md:w-[clamp(3.8rem,10vw,5.6rem)]';
  return 'w-[clamp(2.75rem,14vw,4.95rem)] md:w-[clamp(3.45rem,9.2vw,5.25rem)]';
};

const Cell: React.FC<{ letter: string; status: CharStatus; wordLength: WordLength }> = ({ letter, status, wordLength }) => {
  const baseClasses = `${getCellSizeClass(wordLength)} aspect-square min-w-0 border-2 flex items-center justify-center text-[clamp(1.25rem,5.6vw,2.35rem)] font-black uppercase select-none transition-all duration-300 rounded-xl sm:rounded-2xl tracking-[0.06em] font-mono leading-none`;
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

  return <div className={`${baseClasses} ${statusClasses}`}>{letter}</div>;
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
      rowContent = guess.split('').map((letter, idx) => <Cell key={idx} letter={letter} status={statuses[idx]} wordLength={wordLength} />);
    } else if (i === guesses.length) {
      const chars = currentGuess.split('');
      rowContent = Array.from({ length: wordLength }).map((_, idx) => <Cell key={idx} letter={chars[idx] || ''} status="initial" wordLength={wordLength} />);
    } else {
      rowContent = Array.from({ length: wordLength }).map((_, idx) => <Cell key={idx} letter="" status="initial" wordLength={wordLength} />);
    }

    rows.push(
      <div key={i} className={`flex w-full justify-center gap-[min(1.15vw,0.55rem)] ${isShake ? 'animate-shake' : ''}`} style={{ animation: isShake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}>
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
      <div className="flex w-full max-w-[min(42rem,98vw)] flex-col items-center justify-center gap-[min(0.85dvh,0.48rem)] p-0.5">
        {rows}
      </div>
    </>
  );
};