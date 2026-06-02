import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary, clearStoredGameSession, pickNextSessionWord, readStoredGameSession, writeStoredGameSession } from '../services/gameSessionEngine';
import { motion, AnimatePresence } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, GameRewardInput } from '../services/gamificationRules';

interface AnagramGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onRecordReviewWord?: (word: string) => void | Promise<void>;
}
interface LetterSlot { char: string; isUsed: boolean; originalIndex: number; }
interface GuessLetter { char: string; slotIndex: number; }
interface SavedAnagramSession { solvedCount: number; skippedCount: number; coinsEarned: number; activeWord?: string; shuffledLetters?: string[]; userGuess?: GuessLetter[]; }
const emptySession: SavedAnagramSession = { solvedCount: 0, skippedCount: 0, coinsEarned: 0 };
const sessionKey = (username: string) => `annword:active-anagram-session:v2:${username || 'guest'}`;
const legacySessionKey = (username: string) => `annword:active-anagram-session:v1:${username || 'guest'}`;
export const buildAnagramDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);
const loadSession = (username: string): SavedAnagramSession => {
  const legacy = readStoredGameSession<SavedAnagramSession>(legacySessionKey(username), emptySession);
  const parsed = readStoredGameSession<SavedAnagramSession>(sessionKey(username), legacy);
  return {
    solvedCount: Math.max(0, Number(parsed.solvedCount) || 0), skippedCount: Math.max(0, Number(parsed.skippedCount) || 0), coinsEarned: Math.max(0, Number(parsed.coinsEarned) || 0),
    activeWord: typeof parsed.activeWord === 'string' ? parsed.activeWord.toUpperCase() : undefined,
    shuffledLetters: Array.isArray(parsed.shuffledLetters) ? parsed.shuffledLetters.filter((char): char is string => typeof char === 'string') : undefined,
    userGuess: Array.isArray(parsed.userGuess) ? parsed.userGuess.filter((item): item is GuessLetter => Boolean(item) && typeof item.char === 'string' && typeof item.slotIndex === 'number') : undefined,
  };
};
export const hasSavedAnagramSession = (username: string): boolean => { const session = loadSession(username); return Boolean(session.activeWord) || session.solvedCount > 0 || session.skippedCount > 0; };
export const AnagramGame: React.FC<AnagramGameProps> = ({ onBack, userProfile, onGameReward, onRecordReviewWord }) => {
  const dictionary = useMemo(() => buildAnagramDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const initialSession = useMemo(() => loadSession(userProfile.username), [userProfile.username]);
  const shuffle = useCallback((array: string[]): string[] => { const next = [...array]; for (let index = next.length - 1; index > 0; index -= 1) { const randomIndex = Math.floor(Math.random() * (index + 1)); [next[index], next[randomIndex]] = [next[randomIndex], next[index]]; } if (next.join('') === array.join('') && array.length > 1) return shuffle(array); return next; }, []);
  const restoredWord = useMemo(() => dictionary.find(entry => entry.word === initialSession.activeWord) || null, [dictionary, initialSession.activeWord]);
  const restoredGuess = restoredWord ? initialSession.userGuess || [] : [];
  const restoredCharacters = restoredWord && initialSession.shuffledLetters?.length === restoredWord.word.length ? initialSession.shuffledLetters : restoredWord ? shuffle(restoredWord.word.split('')) : [];
  const usedSlots = new Set(restoredGuess.map(item => item.slotIndex));
  const nextWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckingRef = useRef(false);
  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(restoredWord);
  const [shuffledLetters, setShuffledLetters] = useState<LetterSlot[]>(restoredCharacters.map((char, index) => ({ char, isUsed: usedSlots.has(index), originalIndex: index })));
  const [userGuess, setUserGuess] = useState<GuessLetter[]>(restoredGuess);
  const [status, setStatus] = useState<'playing' | 'checking' | 'success' | 'error' | 'finished'>('playing');
  const [message, setMessage] = useState('');
  const [solvedCount, setSolvedCount] = useState(initialSession.solvedCount);
  const [skippedCount, setSkippedCount] = useState(initialSession.skippedCount);
  const [coinsEarned, setCoinsEarned] = useState(initialSession.coinsEarned);
  const score = solvedCount - skippedCount;
  const xpEarned = solvedCount * 5;
  useEffect(() => { if (status === 'finished') { clearStoredGameSession(sessionKey(userProfile.username), legacySessionKey(userProfile.username)); return; } writeStoredGameSession(sessionKey(userProfile.username), { solvedCount, skippedCount, coinsEarned, activeWord: currentWord?.word, shuffledLetters: shuffledLetters.map(slot => slot.char), userGuess }); clearStoredGameSession(legacySessionKey(userProfile.username)); }, [coinsEarned, currentWord, shuffledLetters, skippedCount, solvedCount, status, userGuess, userProfile.username]);
  const clearNextWordTimeout = useCallback(() => { if (nextWordTimeoutRef.current) { clearTimeout(nextWordTimeoutRef.current); nextWordTimeoutRef.current = null; } }, []);
  const pickNewWord = useCallback(() => { if (dictionary.length === 0) return; isCheckingRef.current = false; const word = pickNextSessionWord('anagram', dictionary) || dictionary[Math.floor(Math.random() * dictionary.length)]; setCurrentWord(word); setShuffledLetters(shuffle(word.word.split('')).map((char, index) => ({ char, isUsed: false, originalIndex: index }))); setUserGuess([]); setStatus('playing'); setMessage(''); }, [dictionary, shuffle]);
  useEffect(() => { if (dictionary.length > 0 && !currentWord) pickNewWord(); }, [dictionary.length, currentWord, pickNewWord]);
  useEffect(() => clearNextWordTimeout, [clearNextWordTimeout]);
  const checkGuess = (guessLetters: GuessLetter[]) => {
    if (!currentWord || isCheckingRef.current || status !== 'playing') return;
    const guess = guessLetters.map(item => item.char).join(''); isCheckingRef.current = true; setStatus('checking'); setMessage('Проверяем слово...');
    if (guess === currentWord.word) { const nextSolvedCount = solvedCount + 1; const earnedCoin = nextSolvedCount % 15 === 0 ? 1 : 0; setSolvedCount(nextSolvedCount); if (earnedCoin) setCoinsEarned(previous => previous + 1); setStatus('success'); setMessage(earnedCoin ? `Правильно! За ${nextSolvedCount} слов получена 1 монета.` : `Правильно! Всего слов: ${nextSolvedCount}`); void Promise.resolve(onGameReward({ type: 'anagram', guessedWords: 1, coinsAdjustment: earnedCoin })).catch(error => console.error('Failed to apply anagram reward', error)); clearNextWordTimeout(); nextWordTimeoutRef.current = setTimeout(pickNewWord, 900); }
    else { setStatus('error'); setMessage('Неверно, попробуйте ещё раз!'); clearNextWordTimeout(); nextWordTimeoutRef.current = setTimeout(() => { isCheckingRef.current = false; setStatus('playing'); setMessage(''); setShuffledLetters(previous => previous.map(slot => ({ ...slot, isUsed: false }))); setUserGuess([]); }, 1000); }
  };
  const handleLetterClick = (letter: string, index: number) => { if (status !== 'playing' || shuffledLetters[index].isUsed || !currentWord) return; const nextGuess = [...userGuess, { char: letter, slotIndex: index }]; setUserGuess(nextGuess); setShuffledLetters(previous => previous.map((slot, slotIndex) => slotIndex === index ? { ...slot, isUsed: true } : slot)); if (nextGuess.length === currentWord.word.length) checkGuess(nextGuess); };
  const handleGuessClick = (guessIndex: number) => { if (status !== 'playing') return; const slotIndex = userGuess[guessIndex].slotIndex; setUserGuess(userGuess.filter((_, index) => index !== guessIndex)); setShuffledLetters(shuffledLetters.map((slot, index) => index === slotIndex ? { ...slot, isUsed: false } : slot)); };
  const skipWord = () => { if (!currentWord || isCheckingRef.current || status !== 'playing') return; isCheckingRef.current = true; setStatus('checking'); setSkippedCount(previous => previous + 1); setMessage(`Слово ${currentWord.word} добавлено для повторения. −1 балл.`); void Promise.resolve(onRecordReviewWord?.(currentWord.word)).catch(error => console.error('Failed to record review word', error)); clearNextWordTimeout(); nextWordTimeoutRef.current = setTimeout(pickNewWord, 850); };
  const finishSession = () => { clearNextWordTimeout(); setStatus('finished'); };
  const restartSession = () => { setSolvedCount(0); setSkippedCount(0); setCoinsEarned(0); setCurrentWord(null); setStatus('playing'); setMessage(''); };
  const progressPreview = applyGameRewardToCharacter(userProfile.pet, { xp: 0, coins: 0, mood: 0, label: 'Сессия анаграмм' });
  if (dictionary.length === 0) return <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  return <div className="flex w-full max-w-md flex-col items-center rounded-3xl bg-white p-3 shadow-xl sm:p-6"><div className="mb-4 flex w-full items-center justify-between gap-2 sm:mb-5"><button type="button" onClick={finishSession} className="rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-black text-indigo-700 sm:px-3 sm:text-sm">Закончить игру</button><div className="flex gap-1.5 text-xs font-black sm:gap-2"><span className="rounded-full bg-indigo-50 px-2.5 py-2 text-indigo-700 sm:px-3">⭐ {score}</span><span className="rounded-full bg-amber-50 px-2.5 py-2 text-amber-700 sm:px-3">Монеты: {coinsEarned}</span></div></div><div className="mb-5 text-center sm:mb-7"><div className="mb-1 text-sm uppercase tracking-tighter text-gray-400">Перевод</div><div className="text-xl font-bold text-indigo-900 sm:text-2xl">{currentWord?.translation}</div></div><div className="mb-5 grid min-h-[3.25rem] w-full grid-flow-col auto-cols-fr items-center gap-1.5 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-2 sm:mb-7 sm:min-h-[60px] sm:gap-2 sm:p-4"><AnimatePresence mode="popLayout">{userGuess.map((item, index) => <motion.button key={`${index}-${item.char}`} layout initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} onClick={() => handleGuessClick(index)} className="flex aspect-square w-full min-w-0 items-center justify-center rounded-lg border-2 border-indigo-500 bg-white text-[clamp(1rem,5.5vw,1.25rem)] font-bold text-indigo-600 shadow-sm">{item.char}</motion.button>)}</AnimatePresence></div><div className="mb-5 grid w-full grid-flow-col auto-cols-fr gap-1.5 sm:mb-7 sm:gap-2">{shuffledLetters.map((slot, index) => <div key={`${slot.originalIndex}-${slot.char}`} className="relative aspect-square min-w-0"><AnimatePresence>{!slot.isUsed && <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleLetterClick(slot.char, index)} className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-indigo-600 text-[clamp(1.1rem,6vw,1.5rem)] font-bold text-white shadow-md">{slot.char}</motion.button>}</AnimatePresence><div className="absolute inset-0 rounded-xl border-2 border-dashed border-gray-200 bg-gray-100" /></div>)}</div>{message && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`mb-4 text-center text-sm font-bold sm:mb-5 ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-indigo-500'}`}>{message}</motion.div>}<div className="grid w-full grid-cols-2 gap-2"><button type="button" onClick={() => { setShuffledLetters(shuffledLetters.map(slot => ({ ...slot, isUsed: false }))); setUserGuess([]); }} disabled={status !== 'playing'} className="rounded-xl bg-gray-100 px-2 py-3 text-sm font-bold text-gray-600 disabled:opacity-50 sm:text-base">Сброс</button><button type="button" onClick={skipWord} disabled={status !== 'playing'} className="rounded-xl bg-rose-50 px-2 py-3 text-sm font-bold text-rose-600 disabled:opacity-50 sm:text-base">Не знаю</button></div><GameResultOverlay isOpen={status === 'finished'} status="completed" title="Игра завершена" subtitle={`Счёт сессии: ${score}`} emoji="🏁" pet={progressPreview.pet} xpGained={xpEarned} coinsGained={coinsEarned} primaryLabel="Играть снова" secondaryLabel="В меню" onPrimary={restartSession} onSecondary={onBack} details={<span>Угадано: <b>{solvedCount}</b> · Не знаю: <b>{skippedCount}</b> · Получено монет: <b>{coinsEarned}</b></span>} /></div>;
};