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

const Cell: React.FC<{ letter: string; status: CharStatus }> = ({ letter, status }) => {
  const baseClasses = 'flex-1 aspect-square min-w-0 max-w-[min(4.15rem,16.8vw,8.6dvh)] sm:max-w-[4.75rem] border-2 flex items-center justify-center text-[clamp(1.25rem,6.5vw,2.35rem)] sm:text-4xl font-black uppercase select-none transition-all duration-300 rounded-xl sm:rounded-2xl tracking-[0.06em] font-mono leading-none';
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

  return (
    <div className={`${baseClasses} ${statusClasses}`}>
      {letter}
    </div>
  );
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
      rowContent = guess.split('').map((letter, idx) => (
        <Cell key={idx} letter={letter} status={statuses[idx]} />
      ));
    } else if (i === guesses.length) {
      const chars = currentGuess.split('');
      rowContent = Array.from({ length: wordLength }).map((_, idx) => (
        <Cell key={idx} letter={chars[idx] || ''} status="initial" />
      ));
    } else {
      rowContent = Array.from({ length: wordLength }).map((_, idx) => (
        <Cell key={idx} letter="" status="initial" />
      ));
    }

    rows.push(
      <div
        key={i}
        className={`flex gap-[clamp(0.28rem,1.25vw,0.6rem)] mb-[clamp(0.24rem,1vw,0.52rem)] justify-center w-full ${isShake ? 'animate-shake' : ''}`}
        style={{ animation: isShake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}
      >
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
      <div className="flex flex-col flex-grow w-full max-w-[min(30rem,98vw)] justify-center p-0.5 sm:p-2 h-full min-h-0">
        {rows}
      </div>
    </>
  );
};