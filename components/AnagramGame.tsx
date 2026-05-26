import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { motion, AnimatePresence } from 'motion/react';
import { GameRewardInput } from '../services/gamificationRules';
import { getUnusedSessionWord } from '../services/sessionWordHistory';

interface AnagramGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}

interface LetterSlot {
  char: string;
  isUsed: boolean;
  originalIndex: number;
}

export const buildAnagramDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => {
  if (customDictionaryEn.length === 0) return fallbackDictionary;

  return customDictionaryEn.map(word => {
    const normalizedWord = word.toUpperCase();
    const builtinEntry = fallbackDictionary.find(entry => entry.word.toUpperCase() === normalizedWord);

    return {
      word: normalizedWord,
      translation: builtinEntry?.translation || normalizedWord,
      level: builtinEntry?.level || 'Custom',
    };
  });
};

export const AnagramGame: React.FC<AnagramGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionary = useMemo(
    () => buildAnagramDictionary(userProfile.customDictionaryEn),
    [userProfile.customDictionaryEn],
  );
  const nextWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckingRef = useRef(false);

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [shuffledLetters, setShuffledLetters] = useState<LetterSlot[]>([]);
  const [userGuess, setUserGuess] = useState<{ char: string, slotIndex: number }[]>([]);
  const [status, setStatus] = useState<'playing' | 'checking' | 'success' | 'error'>('playing');
  const [message, setMessage] = useState('');
  const [solvedCount, setSolvedCount] = useState(0);

  const clearNextWordTimeout = useCallback(() => {
    if (nextWordTimeoutRef.current) {
      clearTimeout(nextWordTimeoutRef.current);
      nextWordTimeoutRef.current = null;
    }
  }, []);

  const shuffle = useCallback((array: string[]): string[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    if (newArray.join('') === array.join('') && array.length > 1) {
      return shuffle(array);
    }
    return newArray;
  }, []);

  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    isCheckingRef.current = false;
    const word = getUnusedSessionWord('anagram', dictionary) || dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);
    
    const letters = word.word.split('');
    const shuffled = shuffle(letters).map((char, index) => ({
      char,
      isUsed: false,
      originalIndex: index
    }));
    
    setShuffledLetters(shuffled);
    setUserGuess([]);
    setStatus('playing');
    setMessage('');
  }, [dictionary, shuffle]);

  useEffect(() => {
    if (dictionary.length > 0 && !currentWord) {
      pickNewWord();
    }
  }, [dictionary.length, currentWord, pickNewWord]);

  useEffect(() => clearNextWordTimeout, [clearNextWordTimeout]);

  const handleLetterClick = (letter: string, index: number) => {
    if (status !== 'playing' || shuffledLetters[index].isUsed) return;
    
    setUserGuess([...userGuess, { char: letter, slotIndex: index }]);
    const newShuffled = [...shuffledLetters];
    newShuffled[index].isUsed = true;
    setShuffledLetters(newShuffled);
  };

  const handleGuessClick = (letter: string, guessIndex: number) => {
    if (status !== 'playing') return;
    
    const slotIndex = userGuess[guessIndex].slotIndex;
    const newGuess = [...userGuess];
    newGuess.splice(guessIndex, 1);
    setUserGuess(newGuess);
    
    const newShuffled = [...shuffledLetters];
    newShuffled[slotIndex].isUsed = false;
    setShuffledLetters(newShuffled);
  };

  const checkGuess = () => {
    if (!currentWord || isCheckingRef.current || status !== 'playing') return;
    const guess = userGuess.map(g => g.char).join('');
    isCheckingRef.current = true;
    setStatus('checking');
    setMessage('Проверяем слово...');

    if (guess === currentWord.word) {
      const nextSolvedCount = solvedCount + 1;
      setSolvedCount(nextSolvedCount);
      setStatus('success');
      setMessage(`Правильно! +1 очко опыта персонажу. Всего слов: ${nextSolvedCount}`);
      void Promise.resolve(onGameReward({ type: 'anagram', guessedWords: 1 })).catch(error => {
        console.error('Failed to apply anagram reward', error);
      });
      clearNextWordTimeout();
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 900);
    } else {
      setStatus('error');
      setMessage('Неверно, попробуй еще раз!');
      clearNextWordTimeout();
      nextWordTimeoutRef.current = setTimeout(() => {
        isCheckingRef.current = false;
        setStatus('playing');
        setMessage('');
        const resetShuffled = shuffledLetters.map(s => ({ ...s, isUsed: false }));
        setShuffledLetters(resetShuffled);
        setUserGuess([]);
      }, 1000);
    }
  };

  if (dictionary.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl shadow-xl">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold mb-2">Словарь пуст!</h2>
        <p className="text-gray-500 mb-6">Выбери другой словарь в настройках.</p>
        <button onClick={onBack} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Назад</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md p-6 bg-white rounded-3xl shadow-xl">
      <div className="w-full flex justify-between items-center mb-6">
        <button 
          onClick={onBack} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Анаграммы</div>
        <div className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{solvedCount} слов</div>
      </div>

      <div className="mb-8 text-center">
        <div className="text-sm text-gray-400 mb-1 uppercase tracking-tighter">Перевод</div>
        <div className="text-2xl font-bold text-indigo-900">{currentWord?.translation || currentWord?.word}</div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-8 min-h-[60px] p-4 bg-indigo-50 rounded-2xl w-full border-2 border-dashed border-indigo-200">
        <AnimatePresence mode="popLayout">
          {userGuess.map((item, i) => (
            <motion.button
              key={`guess-${i}-${item.char}`}
              layout
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => handleGuessClick(item.char, i)}
              className="w-10 h-10 bg-white border-2 border-indigo-500 text-indigo-600 font-bold rounded-lg shadow-sm flex items-center justify-center text-xl"
            >
              {item.char}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {shuffledLetters.map((slot, i) => (
          <div key={`slot-${i}`} className="w-12 h-12 relative">
            <AnimatePresence>
              {!slot.isUsed && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleLetterClick(slot.char, i)}
                  className="absolute inset-0 bg-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center text-2xl z-10"
                >
                  {slot.char}
                </motion.button>
              )}
            </AnimatePresence>
            <div className="absolute inset-0 bg-gray-100 rounded-xl border-2 border-dashed border-gray-200"></div>
          </div>
        ))}
      </div>

      {message && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`mb-6 text-center font-bold ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-indigo-500'}`}
        >
          {message}
        </motion.div>
      )}

      <div className="w-full flex gap-3">
        <button
          onClick={() => {
            const resetShuffled = shuffledLetters.map(s => ({ ...s, isUsed: false }));
            setShuffledLetters(resetShuffled);
            setUserGuess([]);
          }}
          disabled={status !== 'playing'}
          className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Сброс
        </button>
        <button
          onClick={checkGuess}
          disabled={userGuess.length !== (currentWord?.word.length || 0) || status !== 'playing'}
          className={`flex-[2] py-3 font-bold rounded-xl transition ${
            userGuess.length === (currentWord?.word.length || 0) && status === 'playing'
              ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {status === 'checking' ? 'Проверяем...' : 'Проверить'}
        </button>
      </div>
    </div>
  );
};