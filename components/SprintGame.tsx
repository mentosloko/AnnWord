import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { motion, AnimatePresence } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

interface SprintGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}

const hasRussianText = (value: string | undefined): boolean => Boolean(value && /[А-Яа-яЁё]/.test(value));

export const buildSprintDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => {
  const fallbackWithTranslations = fallbackDictionary.filter(entry => hasRussianText(entry.translation));
  if (customDictionaryEn.length === 0) return fallbackWithTranslations;

  const customWithTranslations = customDictionaryEn
    .map(word => {
      const normalizedWord = word.toUpperCase();
      const builtinEntry = fallbackDictionary.find(entry => entry.word.toUpperCase() === normalizedWord && hasRussianText(entry.translation));
      if (!builtinEntry) return null;
      return {
        word: normalizedWord,
        translation: builtinEntry.translation,
        level: builtinEntry.level || 'Custom',
      };
    })
    .filter((entry): entry is EnrichedWord => Boolean(entry));

  return customWithTranslations.length >= 4 ? customWithTranslations : fallbackWithTranslations;
};

export const SprintGame: React.FC<SprintGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionary = useMemo(
    () => buildSprintDictionary(userProfile.customDictionaryEn),
    [userProfile.customDictionaryEn],
  );
  const activeDictionaryRef = useRef<EnrichedWord[]>(dictionary);
  const latestDictionaryRef = useRef<EnrichedWord[]>(dictionary);
  const nextWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardAppliedRef = useRef(false);

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState<'playing' | 'ended'>('playing');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    latestDictionaryRef.current = dictionary;
    if (activeDictionaryRef.current.length === 0 && dictionary.length > 0) {
      activeDictionaryRef.current = dictionary;
    }
  }, [dictionary]);

  const clearNextWordTimeout = useCallback(() => {
    if (nextWordTimeoutRef.current) {
      clearTimeout(nextWordTimeoutRef.current);
      nextWordTimeoutRef.current = null;
    }
  }, []);

  const pickNewWord = useCallback(() => {
    const activeDictionary = activeDictionaryRef.current.filter(entry => hasRussianText(entry.translation));
    if (activeDictionary.length === 0) return;
    const word = activeDictionary[Math.floor(Math.random() * activeDictionary.length)];
    setCurrentWord(word);

    const correctAnswer = word.translation;
    const wrongOptions: string[] = [];
    const maxAttempts = activeDictionary.length * 3;
    let attempts = 0;

    while (wrongOptions.length < 3 && attempts < maxAttempts) {
      attempts++;
      const randomWord = activeDictionary[Math.floor(Math.random() * activeDictionary.length)];
      const candidate = randomWord.translation;
      if (hasRussianText(candidate) && candidate !== correctAnswer && !wrongOptions.includes(candidate)) {
        wrongOptions.push(candidate);
      }
    }

    const fallbackOptions = COMMON_WORDS_EN
      .map(entry => entry.translation)
      .filter(candidate => hasRussianText(candidate) && candidate !== correctAnswer && !wrongOptions.includes(candidate));

    while (wrongOptions.length < 3 && fallbackOptions.length > 0) {
      const candidate = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
      if (!wrongOptions.includes(candidate)) wrongOptions.push(candidate);
    }

    while (wrongOptions.length < 3) {
      const placeholder = `Вариант ${wrongOptions.length + 1}`;
      if (!wrongOptions.includes(placeholder)) wrongOptions.push(placeholder);
    }

    const allOptions = [...wrongOptions, correctAnswer].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
    setFeedback(null);
  }, []);

  const restartGame = () => {
    clearNextWordTimeout();
    activeDictionaryRef.current = latestDictionaryRef.current;
    rewardAppliedRef.current = false;
    setCurrentWord(null);
    setOptions([]);
    setScore(0);
    setTimeLeft(60);
    setFeedback(null);
    setStatus('playing');
  };

  useEffect(() => {
    if (status !== 'playing') return;
    if (!currentWord) pickNewWord();
  }, [status, currentWord, pickNewWord]);

  useEffect(() => {
    if (status !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          clearNextWordTimeout();
          setStatus('ended');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearNextWordTimeout();
    };
  }, [status, clearNextWordTimeout]);

  useEffect(() => {
    if (status === 'ended' && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      void onGameReward({ type: 'sprint', guessedWords: score });
    }
  }, [status, score, onGameReward]);

  const correctAnswer = currentWord?.translation || '';
  const rewardPreview = calculateGameReward({ type: 'sprint', guessedWords: score });
  const progressPreview = applyGameRewardToCharacter(userProfile.pet, rewardPreview);

  const handleOptionClick = (option: string) => {
    if (status !== 'playing' || feedback) return;

    clearNextWordTimeout();

    if (option === correctAnswer) {
      setScore(prev => prev + 1);
      setFeedback('correct');
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 500);
    } else {
      setFeedback('wrong');
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 800);
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

  return (
    <div className="flex flex-col items-center w-full max-w-md p-4 sm:p-6 bg-white rounded-3xl shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 h-2 bg-indigo-100 w-full">
        <motion.div
          className="h-full bg-indigo-600"
          initial={{ width: '100%' }}
          animate={{ width: `${(timeLeft / 60) * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>

      <div className="w-full flex justify-between items-center mb-6 mt-4 gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
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
          <div className="text-4xl sm:text-5xl font-black text-indigo-900 tracking-tight break-words">{currentWord?.word}</div>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 w-full">
        {options.map((option, i) => (
          <motion.button
            key={`${option}-${i}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOptionClick(option)}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base sm:text-lg transition-all border-2 flex justify-between items-center ${
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

      <GameResultOverlay
        isOpen={status === 'ended'}
        status="completed"
        title="Спринт завершён"
        subtitle={`Отгадано слов: ${score}`}
        emoji="🏆"
        pet={progressPreview.pet}
        xpGained={rewardPreview.xp}
        coinsGained={rewardPreview.coins}
        onPrimary={restartGame}
        onSecondary={onBack}
      />
    </div>
  );
};