import React, { useState, useEffect, useCallback } from 'react';
import { EnrichedWord, PetState } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface HangmanGameProps {
  onBack: () => void;
  pet: PetState;
  onSuccess: (xp: number) => void;
  onWinCoins: (coins: number) => void;
  dictionary: EnrichedWord[];
}

export const HangmanGame: React.FC<HangmanGameProps> = ({ onBack, pet, onSuccess, onWinCoins, dictionary }) => {
  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const maxMistakes = 7;

  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    const word = dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);
    setGuessedLetters([]);
    setMistakes(0);
    setStatus('playing');
  }, [dictionary]);

  // Only pick word on initial mount
  useEffect(() => {
    pickNewWord();
  }, []); // Empty dependency array to run only once on mount

  const handleLetterClick = (letter: string) => {
    if (status !== 'playing' || guessedLetters.includes(letter)) return;
    
    setGuessedLetters([...guessedLetters, letter]);
    
    if (!currentWord?.word.includes(letter)) {
      setMistakes(prev => {
        const newMistakes = prev + 1;
        if (newMistakes >= maxMistakes) {
          setStatus('lost');
        }
        return newMistakes;
      });
    } else {
      // Check if won
      const allGuessed = currentWord.word.split('').every(char => [...guessedLetters, letter].includes(char));
      if (allGuessed) {
        setStatus('won');
        onSuccess(50); // Fixed XP for winning
        onWinCoins(15); // Fixed coins for winning
      }
    }
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const renderWord = () => {
    if (!currentWord) return null;
    return currentWord.word.split('').map((char, i) => (
      <div key={i} className="w-10 h-12 border-b-4 border-indigo-600 flex items-center justify-center text-3xl font-black text-indigo-900 mx-1">
        {guessedLetters.includes(char) || status === 'lost' ? char : ''}
      </div>
    ));
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md p-6 bg-white rounded-3xl shadow-xl relative overflow-hidden">
      <div className="w-full flex justify-between items-center mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Угадай слово</div>
        <div className="w-16"></div>
      </div>

      {/* Visual Penalty: Hearts system */}
      <div className="w-full bg-indigo-50 rounded-2xl p-4 mb-8">
        <div className="flex justify-center gap-2 mb-2">
          {Array.from({ length: maxMistakes }).map((_, i) => (
            <motion.span
              key={`heart-${i}`}
              initial={{ scale: 1 }}
              animate={{ 
                scale: i < (maxMistakes - mistakes) ? [1, 1.2, 1] : 1,
                opacity: i < (maxMistakes - mistakes) ? 1 : 0.3,
                filter: i < (maxMistakes - mistakes) ? 'grayscale(0%)' : 'grayscale(100%)'
              }}
              className="text-3xl"
            >
              ❤️
            </motion.span>
          ))}
        </div>
        <div className="text-center text-xs font-bold text-indigo-400 uppercase tracking-widest">
          Осталось попыток: {maxMistakes - mistakes}
        </div>
      </div>

      <div className="flex justify-center mb-12 flex-wrap">
        {renderWord()}
      </div>

      {status === 'playing' ? (
        <div className="grid grid-cols-7 gap-2 w-full">
          {alphabet.map(letter => (
            <button
              key={letter}
              disabled={guessedLetters.includes(letter)}
              onClick={() => handleLetterClick(letter)}
              className={`h-10 rounded-lg font-bold text-sm transition-all ${
                guessedLetters.includes(letter)
                  ? currentWord?.word.includes(letter)
                    ? 'bg-green-100 text-green-600 border-2 border-green-200'
                    : 'bg-gray-100 text-gray-300 border-2 border-gray-100'
                  : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 shadow-sm'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center w-full">
          <div className={`text-2xl font-black mb-4 ${status === 'won' ? 'text-green-600' : 'text-red-500'}`}>
            {status === 'won' ? 'Победа! 🎉' : 'Попробуй еще раз!'}
          </div>
          <div className="text-gray-500 mb-6">
            Загаданное слово: <span className="font-bold text-indigo-900">{currentWord?.word}</span>
            <br />
            Перевод: <span className="italic">{currentWord?.translation}</span>
          </div>
          <button 
            onClick={pickNewWord}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-indigo-700 transition"
          >
            Играть снова
          </button>
        </div>
      )}
    </div>
  );
};
