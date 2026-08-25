import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import {
  buildPlayableGameDictionary,
  clearStoredGameSession,
  pickAdaptiveSessionWord,
  readStoredGameSession,
  updateReviewPriorities,
  WordPracticeResult,
} from '../services/gameSessionEngine';
import { clearPersistedGameSession, isPersistedSessionFor, persistGameSession, readPersistedGameSession } from '../services/gameSessionStore';
import { motion, AnimatePresence } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { PersonalScoreboard } from './PersonalScoreboard';
import { GameRewardInput } from '../services/gamificationRules';
import { isKidsMode } from '../services/modeFlags';

interface AnagramGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
  sessionOwnerId?: string | null;
  dictionaryId?: string;
  dictionaryLabel?: string;
  dictionaryIcon?: string;
}
interface LetterSlot { char: string; isUsed: boolean; originalIndex: number; }
interface GuessLetter { char: string; slotIndex: number; }
interface SavedAnagramSession {
  solvedCount: number;
  skippedCount: number;
  coinsEarned: number;
  wrongAttempts: number;
  activeWord?: string;
  shuffledLetters?: string[];
  userGuess?: GuessLetter[];
}

const MAX_WRONG_ATTEMPTS = 2;
const emptySession: SavedAnagramSession = { solvedCount: 0, skippedCount: 0, coinsEarned: 0, wrongAttempts: 0 };
const sessionKey = (username: string) => `annword:active-anagram-session:v3:${username || 'guest'}`;
const legacySessionKeys = (username: string) => [
  `annword:active-anagram-session:v2:${username || 'guest'}`,
  `annword:active-anagram-session:v1:${username || 'guest'}`,
];

export const buildAnagramDictionary = (
  customDictionaryEn: string[] = [],
  fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN,
): EnrichedWord[] => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);

export const getIncorrectGuessPositions = (guess: string, solvedWord: string): number[] =>
  Array.from({ length: Math.max(guess.length, solvedWord.length) }, (_, index) => index)
    .filter(index => guess[index] !== solvedWord[index]);

export const getIncorrectGuessPositionsAfterAttempt = (guess: string, solvedWord: string, wrongAttempts: number): number[] =>
  wrongAttempts >= MAX_WRONG_ATTEMPTS ? getIncorrectGuessPositions(guess, solvedWord) : [];

export const getAnagramSessionScore = (solvedCount: number): number => Math.max(0, Math.round(Number(solvedCount) || 0));

const normalizeSession = (value: unknown): SavedAnagramSession => {
  const parsed = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<SavedAnagramSession> : emptySession;
  return {
    solvedCount: Math.max(0, Number(parsed.solvedCount) || 0),
    skippedCount: Math.max(0, Number(parsed.skippedCount) || 0),
    coinsEarned: Math.max(0, Number(parsed.coinsEarned) || 0),
    wrongAttempts: Math.min(MAX_WRONG_ATTEMPTS, Math.max(0, Number(parsed.wrongAttempts) || 0)),
    activeWord: typeof parsed.activeWord === 'string' ? parsed.activeWord.toUpperCase() : undefined,
    shuffledLetters: Array.isArray(parsed.shuffledLetters) ? parsed.shuffledLetters.filter((char): char is string => typeof char === 'string') : undefined,
    userGuess: Array.isArray(parsed.userGuess) ? parsed.userGuess.filter((item): item is GuessLetter => Boolean(item) && typeof item.char === 'string' && typeof item.slotIndex === 'number') : undefined,
  };
};

const loadLegacySession = (username: string): SavedAnagramSession => legacySessionKeys(username).reduce(
  (session, key) => normalizeSession(readStoredGameSession<SavedAnagramSession>(key, session)),
  normalizeSession(readStoredGameSession<SavedAnagramSession>(sessionKey(username), emptySession)),
);

const loadSession = (username: string, ownerId?: string | null, dictionaryId = 'live'): SavedAnagramSession => {
  const unified = readPersistedGameSession(ownerId);
  if (isPersistedSessionFor(unified, 'anagrams', dictionaryId)) return normalizeSession(unified?.state);
  if (unified) return { ...emptySession };
  return loadLegacySession(username);
};

export const hasSavedAnagramSession = (username: string): boolean => {
  const session = loadLegacySession(username);
  return Boolean(session.activeWord) || session.solvedCount > 0 || session.skippedCount > 0;
};

export const AnagramGame: React.FC<AnagramGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice, sessionOwnerId, dictionaryId = 'live', dictionaryLabel, dictionaryIcon }) => {
  const dictionary = useMemo(() => buildAnagramDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const initialSession = useMemo(() => loadSession(userProfile.username, sessionOwnerId, dictionaryId), [dictionaryId, sessionOwnerId, userProfile.username]);
  const sessionStatsAppliedRef = useRef(false);
  const nextWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckingRef = useRef(false);
  const showKidsRewards = isKidsMode(userProfile);
  const [reviewPriorities, setReviewPriorities] = useState<Record<string, number>>({ ...(userProfile.stats.wordsToReview || {}) });

  useEffect(() => setReviewPriorities({ ...(userProfile.stats.wordsToReview || {}) }), [userProfile.stats.wordsToReview]);

  const shuffle = useCallback((array: string[]): string[] => {
    const next = [...array];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next.join('') === array.join('') && array.length > 1 ? shuffle(array) : next;
  }, []);

  const restoredWord = useMemo(() => dictionary.find(entry => entry.word === initialSession.activeWord) || null, [dictionary, initialSession.activeWord]);
  const restoredGuess = restoredWord ? initialSession.userGuess || [] : [];
  const restoredCharacters = restoredWord && initialSession.shuffledLetters?.length === restoredWord.word.length ? initialSession.shuffledLetters : restoredWord ? shuffle(restoredWord.word.split('')) : [];
  const usedSlots = new Set(restoredGuess.map(item => item.slotIndex));

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(restoredWord);
  const [shuffledLetters, setShuffledLetters] = useState<LetterSlot[]>(restoredCharacters.map((char, index) => ({ char, isUsed: usedSlots.has(index), originalIndex: index })));
  const [userGuess, setUserGuess] = useState<GuessLetter[]>(restoredGuess);
  const [status, setStatus] = useState<'playing' | 'checking' | 'success' | 'error' | 'skipped' | 'finished'>('playing');
  const [message, setMessage] = useState('');
  const [solvedCount, setSolvedCount] = useState(initialSession.solvedCount);
  const [skippedCount, setSkippedCount] = useState(initialSession.skippedCount);
  const [wrongAttempts, setWrongAttempts] = useState(initialSession.wrongAttempts);
  const [coinsEarned, setCoinsEarned] = useState(showKidsRewards ? initialSession.coinsEarned : 0);
  const [wordEpoch, setWordEpoch] = useState(0);
  const [incorrectGuessPositions, setIncorrectGuessPositions] = useState<number[]>([]);

  const score = getAnagramSessionScore(solvedCount);
  const xpEarned = solvedCount * 5;
  const activeWordLength = currentWord?.word.length || shuffledLetters.length || 1;
  const attemptsLeft = Math.max(0, MAX_WRONG_ATTEMPTS - wrongAttempts);
  const attemptsLabel = wrongAttempts === 0 ? 'На это слово — 2 попытки' : attemptsLeft === 1 ? 'Осталась 1 попытка' : 'Попытки закончились';
  const clearSavedSessions = useCallback(() => {
    clearPersistedGameSession(sessionOwnerId, 'anagrams');
    clearStoredGameSession(sessionKey(userProfile.username), ...legacySessionKeys(userProfile.username));
  }, [sessionOwnerId, userProfile.username]);
  const clearNextWordTimeout = useCallback(() => {
    if (nextWordTimeoutRef.current) {
      clearTimeout(nextWordTimeoutRef.current);
      nextWordTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearNextWordTimeout, [clearNextWordTimeout]);
  useEffect(() => {
    if (status === 'finished') {
      clearSavedSessions();
      return;
    }
    if (currentWord && dictionary.length > 0) {
      const resumableTurn = status === 'playing' && !isCheckingRef.current;
      persistGameSession(sessionOwnerId, {
        gameType: 'anagrams',
        dictionaryId,
        dictionaryWords: dictionary.map(entry => entry.word),
        dictionaryLabel,
        dictionaryIcon,
        state: {
          solvedCount,
          skippedCount,
          coinsEarned: showKidsRewards ? coinsEarned : 0,
          wrongAttempts: resumableTurn ? wrongAttempts : 0,
          activeWord: resumableTurn ? currentWord.word : undefined,
          shuffledLetters: resumableTurn ? shuffledLetters.map(slot => slot.char) : undefined,
          userGuess: resumableTurn ? userGuess : undefined,
        },
        score: { solvedCount, skippedCount, coinsEarned: showKidsRewards ? coinsEarned : 0 },
        rewardState: 'active',
      });
    }
    clearStoredGameSession(sessionKey(userProfile.username), ...legacySessionKeys(userProfile.username));
  }, [coinsEarned, currentWord, dictionary, dictionaryIcon, dictionaryId, dictionaryLabel, sessionOwnerId, shuffledLetters, skippedCount, solvedCount, status, userGuess, userProfile.username, showKidsRewards, wrongAttempts, clearSavedSessions]);

  const registerPractice = (word: string, result: WordPracticeResult) => {
    setReviewPriorities(previous => updateReviewPriorities(previous, word, result));
    void Promise.resolve(onWordPractice?.(word, result)).catch(error => console.error('Failed to save anagram practice priority', error));
  };

  const pickNewWord = useCallback(() => {
    if (!dictionary.length) return;
    clearNextWordTimeout();
    isCheckingRef.current = false;
    const word = pickAdaptiveSessionWord('anagram', dictionary, reviewPriorities, currentWord?.word) || dictionary[Math.floor(Math.random() * dictionary.length)];
    const nextLetters = shuffle(word.word.split('')).map((char, index) => ({ char, isUsed: false, originalIndex: index }));
    setUserGuess([]);
    setShuffledLetters([]);
    setWrongAttempts(0);
    setIncorrectGuessPositions([]);
    setMessage('');
    setStatus('playing');
    setCurrentWord(word);
    setWordEpoch(previous => previous + 1);
    window.requestAnimationFrame(() => setShuffledLetters(nextLetters));
  }, [clearNextWordTimeout, currentWord?.word, dictionary, reviewPriorities, shuffle]);

  useEffect(() => { if (dictionary.length > 0 && !currentWord) pickNewWord(); }, [dictionary.length, currentWord, pickNewWord]);

  const finishWordAfterLimit = (solvedWord: string, guessLetters: GuessLetter[]) => {
    const guess = guessLetters.map(item => item.char).join('');
    setSkippedCount(previous => previous + 1);
    setStatus('skipped');
    setIncorrectGuessPositions(getIncorrectGuessPositionsAfterAttempt(guess, solvedWord, MAX_WRONG_ATTEMPTS));
    setMessage(`Правильный ответ: ${solvedWord} — ${currentWord?.translation}. Две ошибки: слово добавлено для повторения.`);
    clearNextWordTimeout();
  };

  const checkGuess = (guessLetters: GuessLetter[]) => {
    if (!currentWord || isCheckingRef.current || status !== 'playing') return;
    const solvedWord = currentWord.word;
    const guess = guessLetters.map(item => item.char).join('');
    isCheckingRef.current = true;
    setStatus('checking');
    setMessage('Проверяем слово...');

    if (guess === solvedWord) {
      const nextSolvedCount = solvedCount + 1;
      const earnedCoin = showKidsRewards && nextSolvedCount % 10 === 0 ? 1 : 0;
      setSolvedCount(nextSolvedCount);
      setWrongAttempts(0);
      setIncorrectGuessPositions([]);
      if (earnedCoin) setCoinsEarned(previous => previous + 1);
      setStatus('success');
      setMessage(showKidsRewards ? (earnedCoin ? `Правильно! За ${nextSolvedCount} слов получена 1 монета.` : `Правильно! До монеты: ${10 - (nextSolvedCount % 10)} слов.`) : `Правильно! Угадано слов: ${nextSolvedCount}.`);
      void Promise.resolve(onGameReward({ type: 'anagram', guessedWords: 1, coinsAdjustment: earnedCoin })).then(() => onWordPractice?.(solvedWord, 'mastered')).catch(error => console.error('Failed to apply anagram success', error));
      setReviewPriorities(previous => updateReviewPriorities(previous, solvedWord, 'mastered'));
      clearNextWordTimeout();
      nextWordTimeoutRef.current = setTimeout(pickNewWord, 900);
      return;
    }

    registerPractice(solvedWord, 'failed');
    const nextWrongAttempts = wrongAttempts + 1;
    setWrongAttempts(nextWrongAttempts);
    setIncorrectGuessPositions(getIncorrectGuessPositionsAfterAttempt(guess, solvedWord, nextWrongAttempts));
    if (nextWrongAttempts >= MAX_WRONG_ATTEMPTS) {
      finishWordAfterLimit(solvedWord, guessLetters);
      return;
    }
    clearNextWordTimeout();
    isCheckingRef.current = false;
    setStatus('playing');
    setMessage(`Неверно. Попробуйте ещё раз. Осталась ${MAX_WRONG_ATTEMPTS - nextWrongAttempts} попытка.`);
  };

  const handleLetterClick = (letter: string, index: number) => {
    if (status !== 'playing' || shuffledLetters[index]?.isUsed || !currentWord) return;
    const nextGuess = [...userGuess, { char: letter, slotIndex: index }];
    setUserGuess(nextGuess);
    setShuffledLetters(previous => previous.map((slot, slotIndex) => slotIndex === index ? { ...slot, isUsed: true } : slot));
    if (nextGuess.length === currentWord.word.length) checkGuess(nextGuess);
  };

  const handleGuessClick = (guessIndex: number) => {
    if (status !== 'playing') return;
    const item = userGuess[guessIndex];
    if (!item) return;
    setIncorrectGuessPositions([]);
    setUserGuess(previous => previous.filter((_, index) => index !== guessIndex));
    setShuffledLetters(previous => previous.map((slot, index) => index === item.slotIndex ? { ...slot, isUsed: false } : slot));
  };

  const skipWord = () => {
    if (!currentWord || isCheckingRef.current || status !== 'playing') return;
    isCheckingRef.current = true;
    setStatus('skipped');
    setSkippedCount(previous => previous + 1);
    registerPractice(currentWord.word, 'failed');
    setIncorrectGuessPositions([]);
    setUserGuess(currentWord.word.split('').map((char, index) => ({ char, slotIndex: index })));
    setShuffledLetters(previous => previous.map(slot => ({ ...slot, isUsed: true })));
    setMessage(`Ответ: ${currentWord.word} — ${currentWord.translation}. Слово добавлено для повторения.`);
    clearNextWordTimeout();
  };

  const finishSession = () => {
    clearNextWordTimeout();
    if (!sessionStatsAppliedRef.current && (solvedCount > 0 || skippedCount > 0)) {
      sessionStatsAppliedRef.current = true;
      void Promise.resolve(onGameReward({ type: 'anagram', guessedWords: solvedCount, statsOnly: true, wonForStats: solvedCount > 0 })).catch(error => console.error('Failed to save anagram session stats', error));
    }
    setStatus('finished');
  };

  const restartSession = () => {
    clearSavedSessions();
    clearNextWordTimeout();
    sessionStatsAppliedRef.current = false;
    isCheckingRef.current = false;
    setSolvedCount(0);
    setSkippedCount(0);
    setWrongAttempts(0);
    setCoinsEarned(0);
    setIncorrectGuessPositions([]);
    setUserGuess([]);
    setShuffledLetters([]);
    setCurrentWord(null);
    setWordEpoch(previous => previous + 1);
    setStatus('playing');
    setMessage('');
  };

  if (!dictionary.length) return <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;

  return <div className="flex w-full max-w-md flex-col items-center rounded-3xl bg-white p-3 shadow-xl sm:p-6">
    <div className="mb-4 flex w-full items-center justify-between gap-2 sm:mb-5">
      <button type="button" onClick={finishSession} className="rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-black text-indigo-700 sm:px-3 sm:text-sm">Закончить игру</button>
      <div className="flex gap-1.5 text-xs font-black sm:gap-2"><span className="rounded-full bg-indigo-50 px-2.5 py-2 text-indigo-700 sm:px-3">⭐ {score}</span>{showKidsRewards && <span className="rounded-full bg-amber-50 px-2.5 py-2 text-amber-700 sm:px-3">Монеты: {coinsEarned}</span>}</div>
    </div>
    <div className="mb-5 text-center sm:mb-7">
      <div className="mb-1 text-sm uppercase tracking-tighter text-gray-400">Перевод</div>
      <div className="text-xl font-bold text-indigo-900 sm:text-2xl">{currentWord?.translation}</div>
      <div className={`mt-1 text-xs font-black ${wrongAttempts > 0 ? 'text-rose-600' : 'text-indigo-500'}`}>{attemptsLabel}</div>
      {showKidsRewards && <div className="mt-1 text-xs font-black text-amber-600">1 монета за каждые 10 угаданных слов</div>}
    </div>
    <div key={`answer-${currentWord?.word || 'empty'}-${wordEpoch}`} className="mb-5 grid w-full items-center gap-1.5 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-2 sm:mb-7 sm:gap-2 sm:p-4" style={{ gridTemplateColumns: `repeat(${activeWordLength}, minmax(0, 1fr))` }}>
      {Array.from({ length: activeWordLength }).map((_, index) => {
        const item = userGuess[index];
        const isIncorrect = incorrectGuessPositions.includes(index);
        return <div key={`answer-slot-${index}`} className="relative aspect-square min-w-0 rounded-lg border-2 border-indigo-100 bg-white/70"><AnimatePresence mode="wait">{item && <motion.button key={`${currentWord?.word}-${item.slotIndex}-${item.char}`} aria-label={`Убрать букву ${item.char} из позиции ${index + 1}${isIncorrect ? ', неверная позиция' : ''}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} onClick={() => handleGuessClick(index)} disabled={status !== 'playing'} className={`absolute inset-0 flex items-center justify-center rounded-lg border-2 text-[clamp(1rem,5.5vw,1.25rem)] font-bold shadow-sm transition disabled:opacity-100 ${isIncorrect ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'border-indigo-500 bg-white text-indigo-600'}`}>{item.char}</motion.button>}</AnimatePresence></div>;
      })}
    </div>
    <div key={`letters-${currentWord?.word || 'empty'}-${wordEpoch}`} className="mb-5 grid w-full grid-flow-col auto-cols-fr gap-1.5 sm:mb-7 sm:gap-2">{shuffledLetters.map((slot, index) => <div key={`${wordEpoch}-${slot.originalIndex}-${slot.char}`} className="relative aspect-square min-w-0"><AnimatePresence>{!slot.isUsed && status !== 'skipped' && <motion.button aria-label={`Буква ${slot.char}, вариант ${index + 1}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleLetterClick(slot.char, index)} className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-indigo-600 text-[clamp(1.1rem,6vw,1.5rem)] font-bold text-white shadow-md">{slot.char}</motion.button>}</AnimatePresence><div className="absolute inset-0 rounded-xl border-2 border-dashed border-gray-200 bg-gray-100" /></div>)}</div>
    {message && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} aria-live="polite" className={`mb-4 text-center text-sm font-bold sm:mb-5 ${status === 'success' ? 'text-green-600' : status === 'error' || status === 'skipped' || incorrectGuessPositions.length > 0 ? 'text-rose-600' : 'text-indigo-500'}`}>{message}</motion.div>}
    {status === 'skipped' ? <button type="button" onClick={pickNewWord} className="w-full rounded-xl bg-indigo-600 px-3 py-3 text-sm font-black text-white sm:text-base">Следующее слово</button> : <div className="grid w-full grid-cols-2 gap-2"><button type="button" onClick={() => { setShuffledLetters(previous => previous.map(slot => ({ ...slot, isUsed: false }))); setUserGuess([]); setIncorrectGuessPositions([]); setMessage(''); }} disabled={status !== 'playing'} className="rounded-xl bg-gray-100 px-2 py-3 text-sm font-bold text-gray-600 disabled:opacity-50 sm:text-base">Сброс</button><button type="button" onClick={skipWord} disabled={status !== 'playing'} className="rounded-xl bg-rose-50 px-2 py-3 text-sm font-bold text-rose-600 disabled:opacity-50 sm:text-base">Не знаю</button></div>}
    <GameResultOverlay isOpen={status === 'finished'} status="completed" title="Игра завершена" subtitle={`Счёт сессии: ${score}`} emoji="🏁" pet={showKidsRewards ? userProfile.pet : undefined} xpGained={showKidsRewards ? xpEarned : 0} coinsGained={showKidsRewards ? coinsEarned : 0} primaryLabel="Играть снова" secondaryLabel="В меню" scoreboard={<PersonalScoreboard gameId="anagrams" userKey={userProfile.username} value={score} direction="higher" unit="слов" />} onPrimary={restartSession} onSecondary={onBack} details={<span>Угадано: <b>{solvedCount}</b> · Не знаю: <b>{skippedCount}</b>{showKidsRewards ? <> · Получено монет: <b>{coinsEarned}</b></> : null}</span>} />
  </div>;
};