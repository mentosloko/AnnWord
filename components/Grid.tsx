import React from 'react';
import { WordLength, CharStatus } from '../types';

interface GridProps {
  guesses: string[];
  currentGuess: string;
  secretWord: string;
  wordLength: WordLength;
  maxGuesses: number;
  shakeRowIndex?: number | null; // New prop for animation
}

const Cell: React.FC<{ letter: string; status: CharStatus }> = ({ letter, status }) => {
  let baseClasses = "flex-1 aspect-square max-w-[4rem] border-2 flex items-center justify-center text-xl sm:text-3xl font-bold uppercase select-none transition-all duration-300 rounded-md";
  let statusClasses = "";

  switch (status) {
    case 'correct':
      statusClasses = "bg-green-500 border-green-500 text-white";
      break;
    case 'present':
      statusClasses = "bg-yellow-500 border-yellow-500 text-white";
      break;
    case 'absent':
      statusClasses = "bg-gray-500 border-gray-500 text-white";
      break;
    default:
      statusClasses = letter ? "border-gray-400 text-black scale-105" : "border-gray-200 bg-white";
      break;
  }

  return (
    <div className={`${baseClasses} ${statusClasses}`}>
      {letter}
    </div>
  );
};

export const Grid: React.FC<GridProps> = ({ guesses, currentGuess, secretWord, wordLength, maxGuesses, shakeRowIndex }) => {
  // Helper to determine status of a letter in a submitted guess
  // (Note: The main color logic is in getRowStatuses below)
  
  // Refined Wordle Logic for coloring a full row correctly (handling duplicates)
  const getRowStatuses = (guess: string): CharStatus[] => {
    const statuses: CharStatus[] = Array(wordLength).fill('absent');
    const secretArr = secretWord.split('');
    const guessArr = guess.split('');

    // First pass: Correct
    guessArr.forEach((char, i) => {
      if (char === secretArr[i]) {
        statuses[i] = 'correct';
        secretArr[i] = '#'; // Mark as handled
      }
    });

    // Second pass: Present
    guessArr.forEach((char, i) => {
      if (statuses[i] !== 'correct') {
        const indexInSecret = secretArr.indexOf(char);
        if (indexInSecret !== -1) {
          statuses[i] = 'present';
          secretArr[indexInSecret] = '#'; // Mark as handled
        }
      }
    });

    return statuses;
  };

  const rows = [];
  
  // Render past guesses
  for (let i = 0; i < maxGuesses; i++) {
    let rowContent;
    let isShake = i === shakeRowIndex;

    if (i < guesses.length) {
      const guess = guesses[i];
      const statuses = getRowStatuses(guess);
      rowContent = guess.split('').map((letter, idx) => (
        <Cell key={idx} letter={letter} status={statuses[idx]} />
      ));
    } else if (i === guesses.length) {
      // Current row being typed
      const chars = currentGuess.split('');
      rowContent = Array.from({ length: wordLength }).map((_, idx) => (
        <Cell key={idx} letter={chars[idx] || ''} status="initial" />
      ));
    } else {
      // Empty rows
      rowContent = Array.from({ length: wordLength }).map((_, idx) => (
        <Cell key={idx} letter="" status="initial" />
      ));
    }

    rows.push(
      <div 
        key={i} 
        className={`flex gap-1 sm:gap-2 mb-1 sm:mb-2 justify-center w-full ${isShake ? 'animate-shake' : ''}`}
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
      <div className="flex flex-col flex-grow w-full max-w-md justify-center p-2 h-full">
        {rows}
      </div>
    </>
  );
};