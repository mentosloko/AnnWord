import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { motion, AnimatePresence } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, GameRewardInput } from '../services/gamificationRules';
import { getUnusedSessionWord } from '../services/sessionWordHistory';

interface AnagramGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onRecordReviewWord?: (word: string) => void | Promise<void>;
}

interface LetterSlot {
  char: string;
  isUsed: boolean;
  originalIndex: number;
}

interface SavedAnagramSession {
  solvedCount: number;
  skippedCount: number;
  coinsEarned: number;
}

const sessionKey = (username: string) => `annword:active-anagram-session:v1:${username || 'guest'}`;

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

const loadSession = (username: string): SavedAnagramSession => {
  if (typeof window === 'undefined') return { solvedCount: 0, skippedCount: 0, coinsEarned: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(sessionKey(username)) || '{}');
    return {
      solvedCount: Math.max(0, Number(parsed.solvedCount) || 0),
      skippedCount: Math.max(0, Number(parsed.skippedCount) || 0),
      coinsEarned: Math.max(0, Number(parsed.coinsEarned) || 0),
    };
  } catch {
    return { solvedCount: 0, skippedCount: 0, coinsEarned: 0 };
  }
};

export const hasSavedAnagramSession = (username: string): boolean => loadSession(username).solvedCount > 0 || loadSession(username).skippedCount > 0;

export const AnagramGame: React.FC<AnagramGameProps> = ({ onBack, userProfile, onGameReward, onRecordReviewWord }) => {
  const dictionary = useMemo(
    () => buildAnagramDictionary(userProfile.customDictionaryEn),
    [userProfile.customDictionaryEn],
  );
  const initialSession = useMemo(() => loadSession(userProfile.username), [userProfile.username]);
  const nextWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckingRef = useRef(false);

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [shuffledLetters, setShuffledLetters] = useState<LetterSlot[]>([]);
  const [userGuess, setUserGuess] = useState<{ char: string, slotIndex: number }[]>([]);
  const [status, setStatus] = useState<'playing' | 'checking' | 'success' | 'error' | 'finished'>('playing');
  const [message, setMessage] = useState('');
  const [solvedCount, setSolvedCount] = useState(initialSession.solvedCount);
  const [skippedCount, setSkippedCount] = useState(initialSession.skippedCount);
  const [coinsEarned, setCoinsEarned] = useState(initialSession.coinsEarned);

  const score = solvedCount - skippedCount;
  const xpEarned = solvedCount * 5;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status === 'finished') {
      window.localStorage.removeItem(sessionKey(userProfile.username));
      return;
    }
    window.localStorage.setItem(sessionKey(userProfile.username), JSON.stringify({ solvedCount, skippedCount, coinsEarned }));
  }, [coinsEarned, skippedCount, solvedCount, status, userProfile.username]);

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
    if (newArray.join('') === array.join('') && array.length > 1) return shuffle(array);
    return newArray;
  }, []);

  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    isCheckingRef.current = false;
    const word = getUnusedSessionWord('anagram', dictionary) || dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);
    setShuffledLetters(shuffle(word.word.split('')).map((char, index) => ({ char, isUsed: false, originalIndex: index })));
    setUserGuess([]);
    setStatus('playing');
    setMessage('');
  }, [dictionary, shuffle]);

  useEffect(() => {
    if (dictionary.length > 0 && !currentWord) pickNewWord();
  }, [dictionary.length, currentWord, pickNewWord]);

  useEffect(() => clearNextWordTimeout, [clearNextWordTimeout]);

  const handleLetterClick = (letter: string, index: number) => {
    if (status !== 'playing' || shuffledLetters[index].isUsed) return;
    setUserGuess([...userGuess, { char: letter, slotIndex: index }]);
    const next = [...shuffledLetters];
    next[index].isUsed = true;
    setShuffledLetters(next);
  };

  const handleGuessClick = (_letter: string, guessIndex: number) => {
    if (status !== 'playing') return;
    const slotIndex = userGuess[guessIndex].slotIndex;
    const nextGuess = [...userGuess];
    nextGuess.splice(guessIndex, 1);
    setUserGuess(nextGuess);
    const next = [...shuffledLetters];
    next[slotIndex].isUsed = false;
    setShuffledLetters(next);
  };

  const checkGuess = () => {
    if (!currentWord || isCheckingRef.current || status !== 'playing') return;
    const guess = userGuess.map(g => g.char).join('');
    isCheckingRef.current = true;
    setStatus('checking');
    setMessage('Проверяем слово...');

    if (guess === currentWord.word) {
      const nextSolvedCount = solvedCount + 1;
      const earnedCoin = nextSolvedCount % 15 === 0 ? 1 : 0;
      setSolvedCount(nextSolvedCount);
      if (earnedCoin) setCoinsEarned(prev => prev + 1);
      setStatus('success');
      setMessage(earnedCoin ? `Правильно! За ${nextSolvedCount} слов получен +1 ₽.` : `Правильно! Всего слов: ${nextSolvedCount}`);
      void Promise.resolve(onGameReward({ type: 'anagram', guessedWords: 1, coinsAdjustment: earnedCoin })).catch(error => console.error('Failed to apply anagram reward', error));
      clearNextWordTimeout();
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 900);
    } else {
      setStatus('error');
      setMessage('Неверно, попробуй ещё раз!');
      clearNextWordTimeout();
      nextWordTimeoutRef.current = setTimeout(() => {
        isCheckingRef.current = false;
        setStatus('playing');
        setMessage('');
        setShuffledLetters(shuffledLetters.map(slot => ({ ...slot, isUsed: false })));
        setUserGuess([]);
      }, 1000);
    }
  };

  const skipWord = () => {
    if (!currentWord || status !== 'playing') return;
    setSkippedCount(prev => prev + 1);
    setMessage(`Слово ${currentWord.word} добавлено для повторения. −1 балл.`);
    void Promise.resolve(onRecordReviewWord?.(currentWord.word)).catch(error => console.error('Failed to record review word', error));
    clearNextWordTimeout();
    nextWordTimeoutRef.current = setTimeout(pickNewWord, 850);
  };

  const finishSession = () => {
    clearNextWordTimeout();
    setStatus('finished');
  };

  const restartSession = () => {
    setSolvedCount(0);
    setSkippedCount(0);
    setCoinsEarned(0);
    setCurrentWord(null);
    setStatus('playing');
    setMessage('');
  };

  const progressPreview = applyGameRewardToCharacter(userProfile.pet, { xp: 0, coins: 0, mood: 0, label: 'Anagram session' });

  if (dictionary.length === 0) {
    return <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl shadow-xl"><div className="text-6xl mb-4">📚</div><h2 className="text-2xl font-bold mb-2">Словарь пуст!</h2><p className="text-gray-500 mb-6">Выбери другой словарь в настройках.</p><button onClick={onBack} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Назад</button></div>;
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md p-4 sm:p-6 bg-white rounded-3xl shadow-xl">
      <div className="w-full flex justify-between items-center mb-5 gap-2">
        <button type="button" onClick={finishSession} className="text-sm font-black text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl">Закончить игру</button>
        <div className="flex gap-2 text-xs font-black">
          <span className="rounded-full bg-indigo-50 px-3 py-2 text-indigo-700">⭐ {score}</span>
          <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">₽ {coinsEarned}</span>
        </div>
      </div>
      <div className="mb-7 text-center"><div className="text-sm text-gray-400 mb-1 uppercase tracking-tighter">Перевод</div><div className="text-2xl font-bold text-indigo-900">{currentWord?.translation || currentWord?.word}</div></div>
      <div className="flex flex-wrap justify-center gap-2 mb-7 min-h-[60px] p-4 bg-indigo-50 rounded-2xl w-full border-2 border-dashed border-indigo-200">
        <AnimatePresence mode="popLayout">{userGuess.map((item, i) => <motion.button key={`guess-${i}-${item.char}`} layout initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} onClick={() => handleGuessClick(item.char, i)} className="w-10 h-10 bg-white border-2 border-indigo-500 text-indigo-600 font-bold rounded-lg shadow-sm flex items-center justify-center text-xl">{item.char}</motion.button>)}</AnimatePresence>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mb-7">{shuffledLetters.map((slot, i) => <div key={`slot-${i}`} className="w-12 h-12 relative"><AnimatePresence>{!slot.isUsed && <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleLetterClick(slot.char, i)} className="absolute inset-0 bg-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center text-2xl z-10">{slot.char}</motion.button>}</AnimatePresence><div className="absolute inset-0 bg-gray-100 rounded-xl border-2 border-dashed border-gray-200" /></div>)}</div>
      {message && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`mb-5 text-center text-sm font-bold ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-indigo-500'}`}>{message}</motion.div>}
      <div className="w-full grid grid-cols-3 gap-2">
        <button type="button" onClick={() => { setShuffledLetters(shuffledLetters.map(slot => ({ ...slot, isUsed: false }))); setUserGuess([]); }} disabled={status !== 'playing'} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl disabled:opacity-50">Сброс</button>
        <button type="button" onClick={skipWord} disabled={status !== 'playing'} className="py-3 bg-rose-50 text-rose-600 font-bold rounded-xl disabled:opacity-50">Не знаю</button>
        <button type="button" onClick={checkGuess} disabled={userGuess.length !== (currentWord?.word.length || 0) || status !== 'playing'} className={`py-3 font-bold rounded-xl ${userGuess.length === (currentWord?.word.length || 0) && status === 'playing' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Проверить</button>
      </div>
      <GameResultOverlay isOpen={status === 'finished'} status="completed" title="Игра завершена" subtitle={`Счёт сессии: ${score}`} emoji="🏁" pet={progressPreview.pet} xpGained={xpEarned} coinsGained={coinsEarned} primaryLabel="Играть снова" secondaryLabel="В меню" onPrimary={restartSession} onSecondary={onBack} details={<span>Угадано: <b>{solvedCount}</b> · Не знаю: <b>{skippedCount}</b> · Получено: <b>{coinsEarned} ₽</b></span>} />
    </div>
  );
};
