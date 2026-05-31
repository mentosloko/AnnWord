import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { hasRussianTranslation } from '../services/dictionaryEngine';
import { motion, AnimatePresence } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { getUnusedSessionWord } from '../services/sessionWordHistory';

interface SprintGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}

const getPlayableSprintDictionary = (entries: EnrichedWord[]): EnrichedWord[] => {
  const playable = entries.filter(entry => hasRussianTranslation(entry.translation));
  if (playable.length >= 4) return playable;
  return COMMON_WORDS_EN.filter(entry => hasRussianTranslation(entry.translation));
};

export const buildSprintDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => {
  if (customDictionaryEn.length === 0) return fallbackDictionary.filter(entry => hasRussianTranslation(entry.translation));

  const translatedByWord = new Map(
    fallbackDictionary
      .filter(entry => hasRussianTranslation(entry.translation))
      .map(entry => [entry.word.toUpperCase(), entry]),
  );

  return customDictionaryEn
    .map(word => translatedByWord.get(word.trim().toUpperCase()))
    .filter((entry): entry is EnrichedWord => Boolean(entry));
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
    const activeDictionary = getPlayableSprintDictionary(activeDictionaryRef.current);
    if (activeDictionary.length === 0) return;
    const word = getUnusedSessionWord('sprint', activeDictionary) || activeDictionary[Math.floor(Math.random() * activeDictionary.length)];
    setCurrentWord(word);

    const correctAnswer = word.translation;
    const wrongOptions: string[] = [];
    const maxAttempts = activeDictionary.length * 3;
    let attempts = 0;

    while (wrongOptions.length < 3 && attempts < maxAttempts) {
      attempts++;
      const randomWord = activeDictionary[Math.floor(Math.random() * activeDictionary.length)];
      const candidate = randomWord.translation;
      if (hasRussianTranslation(candidate) && candidate !== correctAnswer && !wrongOptions.includes(candidate)) {
        wrongOptions.push(candidate);
      }
    }

    const fallbackOptions = COMMON_WORDS_EN
      .map(entry => entry.translation)
      .filter(candidate => hasRussianTranslation(candidate) && candidate !== correctAnswer && !wrongOptions.includes(candidate));

    while (wrongOptions.length < 3 && fallbackOptions.length > 0) {
      const candidate = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
      if (!wrongOptions.includes(candidate)) wrongOptions.push(candidate);
    }

    while (wrongOptions.length < 3) {
      const placeholder = `Вариант ${wrongOptions.length + 1}`;
      if (!wrongOptions.includes(placeholder)) wrongOptions.push(placeholder);
    }

    setOptions([...wrongOptions, correctAnswer].sort(() => Math.random() - 0.5));
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
    return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  }

  return (
    <div className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-3xl bg-white p-4 shadow-xl sm:p-6">
      <div className="absolute left-0 top-0 h-2 w-full bg-indigo-100"><motion.div className="h-full bg-indigo-600" initial={{ width: '100%' }} animate={{ width: `${(timeLeft / 60) * 100}%` }} transition={{ duration: 1, ease: 'linear' }} /></div>
      <div className="mb-6 mt-4 flex w-full items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 font-bold text-gray-500 transition hover:text-indigo-600"><span className="text-xl">←</span> Меню</button>
        <div className="flex items-center gap-2 sm:gap-4"><div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1"><span className="text-xl">⏱️</span><span className={`font-mono text-xl font-bold ${timeLeft < 10 ? 'animate-pulse text-red-500' : 'text-gray-700'}`}>{timeLeft}с</span></div><div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1"><span className="text-xl">⭐</span><span className="text-xl font-bold text-indigo-600">{score}</span></div></div>
      </div>
      <AnimatePresence mode="wait"><motion.div key={currentWord?.word} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="mb-12 text-center"><div className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-400">Как переводится?</div><div className="break-words text-4xl font-black tracking-tight text-indigo-900 sm:text-5xl">{currentWord?.word}</div></motion.div></AnimatePresence>
      <div className="grid w-full grid-cols-1 gap-3">{options.map((option, index) => <motion.button key={`${option}-${index}`} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleOptionClick(option)} className={`flex w-full items-center justify-between rounded-2xl border-2 px-6 py-4 text-base font-bold transition-all sm:text-lg ${feedback === 'correct' && option === correctAnswer ? 'border-green-600 bg-green-500 text-white shadow-lg' : feedback === 'wrong' && option !== correctAnswer ? 'border-gray-100 bg-white text-gray-400 opacity-50' : feedback === 'wrong' && option === correctAnswer ? 'border-green-500 bg-green-100 text-green-700' : 'border-gray-100 bg-white text-gray-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50'}`}><span>{option}</span>{feedback === 'correct' && option === correctAnswer && <span>✅</span>}</motion.button>)}</div>
      <GameResultOverlay isOpen={status === 'ended'} status="completed" title="Спринт завершён" subtitle={`Отгадано слов: ${score}`} emoji="🏆" pet={progressPreview.pet} xpGained={rewardPreview.xp} coinsGained={rewardPreview.coins} onPrimary={restartGame} onSecondary={onBack} />
    </div>
  );
};
