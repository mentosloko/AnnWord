import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { hasRussianTranslation } from '../services/dictionaryEngine';
import { buildPlayableGameDictionary, pickAdaptiveSessionWord, updateReviewPriorities, WordPracticeResult } from '../services/gameSessionEngine';
import { motion, AnimatePresence } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

interface SprintGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
  paused?: boolean;
}
interface SprintQuestion { id: number; word: EnrichedWord; options: string[]; correctAnswer: string; }

export const buildSprintDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] =>
  buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);

const hasEnoughSprintOptions = (entries: EnrichedWord[]): boolean =>
  new Set(entries.map(entry => entry.translation).filter(hasRussianTranslation)).size >= 4;

export const SprintGame: React.FC<SprintGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice, paused = false }) => {
  const dictionary = useMemo(() => buildSprintDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const activeDictionaryRef = useRef<EnrichedWord[]>(dictionary);
  const latestDictionaryRef = useRef<EnrichedWord[]>(dictionary);
  const nextWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardAppliedRef = useRef(false);
  const questionIdRef = useRef(0);
  const [reviewPriorities, setReviewPriorities] = useState<Record<string, number>>({ ...(userProfile.stats.wordsToReview || {}) });
  const [question, setQuestion] = useState<SprintQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState<'playing' | 'ended'>('playing');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const dictionaryIsPlayable = hasEnoughSprintOptions(dictionary);

  useEffect(() => {
    latestDictionaryRef.current = dictionary;
    if (activeDictionaryRef.current.length === 0 && dictionary.length > 0) activeDictionaryRef.current = dictionary;
  }, [dictionary]);
  useEffect(() => setReviewPriorities({ ...(userProfile.stats.wordsToReview || {}) }), [userProfile.stats.wordsToReview]);
  const clearNextWordTimeout = useCallback(() => {
    if (nextWordTimeoutRef.current) {
      clearTimeout(nextWordTimeoutRef.current);
      nextWordTimeoutRef.current = null;
    }
  }, []);
  const registerPractice = (word: string, result: WordPracticeResult) => {
    setReviewPriorities(previous => updateReviewPriorities(previous, word, result));
    void Promise.resolve(onWordPractice?.(word, result)).catch(error => console.error('Failed to save sprint practice priority', error));
  };
  const buildQuestion = useCallback((previousWord?: string): SprintQuestion | null => {
    const activeDictionary = activeDictionaryRef.current;
    if (!hasEnoughSprintOptions(activeDictionary)) return null;
    const word = pickAdaptiveSessionWord('sprint', activeDictionary, reviewPriorities, previousWord) || activeDictionary[Math.floor(Math.random() * activeDictionary.length)];
    const correctAnswer = word.translation;
    const wrongOptions = Array.from(new Set(activeDictionary.map(entry => entry.translation).filter(candidate => hasRussianTranslation(candidate) && candidate !== correctAnswer))).sort(() => Math.random() - 0.5).slice(0, 3);
    questionIdRef.current += 1;
    return { id: questionIdRef.current, word, correctAnswer, options: [...wrongOptions, correctAnswer].sort(() => Math.random() - 0.5) };
  }, [reviewPriorities]);
  const pickNewWord = useCallback(() => { setQuestion(previous => buildQuestion(previous?.word.word) || previous); setFeedback(null); }, [buildQuestion]);
  const restartGame = () => {
    clearNextWordTimeout();
    activeDictionaryRef.current = latestDictionaryRef.current;
    rewardAppliedRef.current = false;
    questionIdRef.current = 0;
    setQuestion(null);
    setScore(0);
    setTimeLeft(60);
    setFeedback(null);
    setStatus('playing');
  };
  useEffect(() => { if (dictionaryIsPlayable && status === 'playing' && !question) pickNewWord(); }, [dictionaryIsPlayable, status, question, pickNewWord]);
  useEffect(() => {
    if (!dictionaryIsPlayable || status !== 'playing' || paused) return;
    const timer = setInterval(() => {
      setTimeLeft(previous => {
        if (previous <= 1) {
          clearInterval(timer);
          clearNextWordTimeout();
          setStatus('ended');
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => { clearInterval(timer); clearNextWordTimeout(); };
  }, [dictionaryIsPlayable, status, paused, clearNextWordTimeout]);
  useEffect(() => {
    if (status === 'ended' && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      void onGameReward({ type: 'sprint', guessedWords: score });
    }
  }, [status, score, onGameReward]);
  const rewardPreview = calculateGameReward({ type: 'sprint', guessedWords: score });
  const progressPreview = applyGameRewardToCharacter(userProfile.pet, rewardPreview);
  const handleOptionClick = (option: string) => {
    if (status !== 'playing' || feedback || !question || paused) return;
    clearNextWordTimeout();
    if (option === question.correctAnswer) {
      setScore(previous => previous + 1);
      setFeedback('correct');
      registerPractice(question.word.word, 'mastered');
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 500);
    } else {
      setFeedback('wrong');
      registerPractice(question.word.word, 'failed');
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 800);
    }
  };

  if (dictionary.length === 0) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  if (!dictionaryIsPlayable) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="mb-4 text-6xl">⚡</div><h2 className="mb-2 text-2xl font-bold">Недостаточно слов для Спринта</h2><p className="mb-6 text-gray-500">Для игры нужно не менее 4 слов с разными переводами в выбранном словаре. Добавьте слова в свой словарь или выберите встроенный.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  if (status === 'ended') return <GameResultOverlay isOpen status="completed" title="Спринт завершён" subtitle={`Отгадано слов: ${score}`} emoji="🏆" pet={progressPreview.pet} xpGained={rewardPreview.xp} coinsGained={rewardPreview.coins} onPrimary={restartGame} onSecondary={onBack} />;

  return (
    <div className="relative flex h-full min-h-0 w-full max-w-md flex-col items-center overflow-hidden rounded-3xl bg-white p-3 shadow-xl sm:h-auto sm:p-6" aria-busy={paused}>
      <div className="absolute left-0 top-0 h-2 w-full bg-indigo-100"><motion.div className="h-full bg-indigo-600" initial={{ width: '100%' }} animate={{ width: `${(timeLeft / 60) * 100}%` }} transition={{ duration: paused ? 0 : 1, ease: 'linear' }} /></div>
      <div className="mb-3 mt-2 flex w-full shrink-0 items-center justify-between gap-2 sm:mb-6 sm:mt-4 sm:gap-3"><button onClick={onBack} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm font-bold text-gray-500 transition hover:text-indigo-600 sm:px-3 sm:text-base"><span className="text-lg sm:text-xl" aria-hidden="true">←</span> Меню</button><div className="flex items-center gap-1.5 sm:gap-4"><div className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 sm:gap-2 sm:px-3"><span className="text-base sm:text-xl" aria-hidden="true">⏱️</span><span className={`font-mono text-lg font-bold sm:text-xl ${timeLeft < 10 ? 'animate-pulse text-red-500' : 'text-gray-700'}`}>{timeLeft}с</span></div><div className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 sm:gap-2 sm:px-3"><span className="text-base sm:text-xl" aria-hidden="true">⭐</span><span className="text-lg font-bold text-indigo-600 sm:text-xl">{score}</span></div></div></div>
      {paused && <div className="mb-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-500">Пауза</div>}
      <AnimatePresence mode="wait"><motion.div key={question?.id || 'empty'} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="mb-4 mt-1 shrink-0 text-center sm:mb-12"><div className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400 sm:mb-2 sm:text-sm">Как переводится?</div><div className="break-words text-[clamp(1.9rem,9vw,2.65rem)] font-black tracking-tight text-indigo-900 sm:text-5xl">{question?.word.word}</div></motion.div></AnimatePresence>
      <div className="grid min-h-0 w-full flex-1 grid-cols-1 content-center gap-2 sm:flex-none sm:gap-3">{question?.options.map((option, index) => <motion.button key={`${question.id}-${option}-${index}`} aria-label={`Ответ: ${option}`} whileHover={{ scale: paused ? 1 : 1.02 }} whileTap={{ scale: paused ? 1 : 0.98 }} disabled={paused || status !== 'playing'} onClick={() => handleOptionClick(option)} className={`flex w-full min-h-0 items-center justify-between rounded-2xl border-2 px-4 py-[clamp(0.55rem,1.65dvh,1rem)] text-sm font-bold transition-all disabled:opacity-60 sm:px-6 sm:text-lg ${feedback === 'correct' && option === question.correctAnswer ? 'border-green-600 bg-green-500 text-white shadow-lg' : feedback === 'wrong' && option !== question.correctAnswer ? 'border-gray-100 bg-white text-gray-400 opacity-50' : feedback === 'wrong' && option === question.correctAnswer ? 'border-green-500 bg-green-100 text-green-700' : 'border-gray-100 bg-white text-gray-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50'}`}><span>{option}</span>{feedback === 'correct' && option === question.correctAnswer && <span aria-hidden="true">✅</span>}</motion.button>)}</div>
    </div>
  );
};
