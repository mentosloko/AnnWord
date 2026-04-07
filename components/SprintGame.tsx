import React, { useState, useEffect, useCallback } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { motion, AnimatePresence } from 'motion/react';

interface SprintGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onWinCoins: (coins: number) => void;
  onAddXP: (xp: number) => void;
}

export const SprintGame: React.FC<SprintGameProps> = ({ onBack, userProfile, onWinCoins, onAddXP }) => {
  const dictionary: EnrichedWord[] = userProfile.customDictionaryEn && userProfile.customDictionaryEn.length > 0
    ? userProfile.customDictionaryEn.map(w => ({ word: w.toUpperCase(), translation: w, level: 'Custom' }))
    : COMMON_WORDS_EN;

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState<'playing' | 'ended'>('playing');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    const word = dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);

    // Use translation if available, otherwise fall back to the word itself
    const correctAnswer = word.translation || word.word;

    // Build wrong options without an infinite loop:
    // try up to dictionary.length * 3 times, then fill with positional fallbacks.
    const wrongOptions: string[] = [];
    const maxAttempts = dictionary.length * 3;
    let attempts = 0;

    while (wrongOptions.length < 3 && attempts < maxAttempts) {
      attempts++;
      const randomWord = dictionary[Math.floor(Math.random() * dictionary.length)];
      const candidate = randomWord.translation || randomWord.word;
      if (candidate !== correctAnswer && !wrongOptions.includes(candidate)) {
        wrongOptions.push(candidate);
      }
    }

    // Fallback: if we still don't have 3 wrong options fill with placeholders
    while (wrongOptions.length < 3) {
      const placeholder = `Вариант ${wrongOptions.length + 1}`;
      if (!wrongOptions.includes(placeholder)) {
        wrongOptions.push(placeholder);
      }
    }

    const allOptions = [...wrongOptions, correctAnswer].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
    setFeedback(null);
  }, [dictionary]);

  useEffect(() => {
    if (status === 'playing') {
      pickNewWord();
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setStatus('ended');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, pickNewWord]);

  useEffect(() => {
    if (status === 'ended') {
      onAddXP(score * 10);
      onWinCoins(score * 2);
    }
  }, [status]);

  const correctAnswer = currentWord?.translation || currentWord?.word || '';

  const handleOptionClick = (option: string) => {
    if (status !== 'playing' || feedback) return;

    if (option === correctAnswer) {
      setScore(prev => prev + 1);
      setFeedback('correct');
      setTimeout(pickNewWord, 500);
    } else {
      setFeedback('wrong');
      setTimeout(pickNewWord, 800);
    }
  };

  if (dictionary.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold mb-2">Словарь пуст!</h2>
        <p className="text-gray-500 mb-6">Выбери другой словарь в настройках.</p>
        <button onClick={onBack} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Назад</button>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-black text-indigo-900 mb-2">Время вышло!</h2>
        <p className="text-gray-500 mb-6 text-lg">Твой результат: <span className="font-bold text-indigo-600">{score}</span> очков</p>
        <div className="bg-indigo-50 p-4 rounded-2xl mb-8 w-full">
            <div className="text-sm text-indigo-400 uppercase font-bold mb-1">Опыт питомца</div>
            <div className="text-2xl font-black text-indigo-600">+{score * 10} XP</div>
        </div>
        <button onClick={onBack} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-indigo-700 transition active:scale-95">Назад в меню</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md p-6 bg-white rounded-3xl shadow-xl relative overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 h-2 bg-indigo-100 w-full">
        <motion.div 
          className="h-full bg-indigo-600"
          initial={{ width: '100%' }}
          animate={{ width: `${(timeLeft / 60) * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>

      <div className="w-full flex justify-between items-center mb-6 mt-4">
        <button 
          onClick={onBack} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
            <span className="text-xl">⏱️</span>
            <span className={`font-mono font-bold text-xl ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
              {timeLeft}с
            </span>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full">
            <span className="text-xl">⭐</span>
            <span className="font-bold text-indigo-600 text-xl">{score}</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentWord?.word}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50, opacity: 0 }}
          className="text-center mb-12"
        >
          <div className="text-sm text-gray-400 mb-2 uppercase tracking-widest font-bold">Как переводится?</div>
          <div className="text-5xl font-black text-indigo-900 tracking-tight">{currentWord?.word}</div>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 w-full">
        {options.map((option, i) => (
          <motion.button
            key={`${option}-${i}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOptionClick(option)}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all border-2 flex justify-between items-center ${
              feedback === 'correct' && option === correctAnswer
                ? 'bg-green-500 border-green-600 text-white shadow-lg'
                : feedback === 'wrong' && option !== correctAnswer
                ? 'bg-white border-gray-100 text-gray-400 opacity-50'
                : feedback === 'wrong' && option === correctAnswer
                ? 'bg-green-100 border-green-500 text-green-700'
                : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm'
            }`}
          >
            <span>{option}</span>
            {feedback === 'correct' && option === correctAnswer && <span>✅</span>}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
