import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary, pickNextSessionWord, WordPracticeResult } from '../services/gameSessionEngine';
import { clearPersistedGameSession, isPersistedSessionFor, persistGameSession, readPersistedGameSession } from '../services/gameSessionStore';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { PersonalScoreboard } from './PersonalScoreboard';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { isKidsMode } from '../services/modeFlags';

interface HangmanGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
  sessionOwnerId?: string | null;
  dictionaryId?: string;
  dictionaryLabel?: string;
  dictionaryIcon?: string;
}
interface SavedHangmanState { currentWord: string; guessedLetters: string[]; mistakes: number; }
export const buildHangmanDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary).map(entry => ({ ...entry, word: entry.word.toUpperCase().replace(/[^A-Z]/g, '') })).filter(entry => Boolean(entry.word));

const normalizeSavedHangmanState = (value: unknown, dictionary: EnrichedWord[], maxMistakes: number): { currentWord: EnrichedWord; guessedLetters: string[]; mistakes: number } | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<SavedHangmanState>;
  const currentWord = typeof raw.currentWord === 'string' ? dictionary.find(entry => entry.word === raw.currentWord) : undefined;
  if (!currentWord || !Array.isArray(raw.guessedLetters)) return null;
  const guessedLetters = Array.from(new Set(raw.guessedLetters.filter((letter): letter is string => typeof letter === 'string' && /^[A-Z]$/.test(letter))));
  const mistakes = Math.max(0, Math.min(maxMistakes - 1, Math.round(Number(raw.mistakes) || 0)));
  return { currentWord, guessedLetters, mistakes };
};

export const HangmanGame: React.FC<HangmanGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice, sessionOwnerId, dictionaryId = 'live', dictionaryLabel, dictionaryIcon }) => {
  const dictionarySignature = userProfile.customDictionaryEn.join('|');
  const dictionary = useMemo(() => buildHangmanDictionary(userProfile.customDictionaryEn), [dictionarySignature]);
  const maxMistakes = 7;
  const restored = useMemo(() => {
    const session = readPersistedGameSession(sessionOwnerId);
    return isPersistedSessionFor(session, 'hangman', dictionaryId) ? normalizeSavedHangmanState(session?.state, dictionary, maxMistakes) : null;
  }, [dictionary, dictionaryId, sessionOwnerId]);
  const rewardAppliedRef = useRef(false);
  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(restored?.currentWord || null), [guessedLetters, setGuessedLetters] = useState<string[]>(restored?.guessedLetters || []), [mistakes, setMistakes] = useState(restored?.mistakes || 0), [finalMistakes, setFinalMistakes] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing'), [liveMessage, setLiveMessage] = useState(restored ? 'Продолжаем сохранённую игру.' : '');
  const showKidsRewards = isKidsMode(userProfile);
  const persistActiveRound = useCallback((word: EnrichedWord, letters: string[], mistakeCount: number) => {
    persistGameSession(sessionOwnerId, {
      gameType: 'hangman',
      dictionaryId,
      dictionaryWords: dictionary.map(entry => entry.word),
      dictionaryLabel,
      dictionaryIcon,
      state: { currentWord: word.word, guessedLetters: letters, mistakes: mistakeCount },
      score: { mistakes: mistakeCount, guessedLetters: letters.length },
      rewardState: 'active',
    });
  }, [dictionary, dictionaryIcon, dictionaryId, dictionaryLabel, sessionOwnerId]);
  const pickNewWord = useCallback(() => {
    if (!dictionary.length) return;
    clearPersistedGameSession(sessionOwnerId, 'hangman');
    const word = pickNextSessionWord('hangman', dictionary) || dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word); setGuessedLetters([]); setMistakes(0); setFinalMistakes(0); setStatus('playing'); setLiveMessage('Новая игра. Выберите букву.'); rewardAppliedRef.current = false;
    persistActiveRound(word, [], 0);
  }, [dictionary, persistActiveRound, sessionOwnerId]);
  useEffect(() => { if (!currentWord) pickNewWord(); }, [currentWord, pickNewWord]);
  useEffect(() => {
    if ((status === 'won' || status === 'lost') && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      clearPersistedGameSession(sessionOwnerId, 'hangman');
      void onGameReward({ type: 'hangman', won: status === 'won', mistakes: finalMistakes, maxMistakes });
      if (currentWord) void Promise.resolve(onWordPractice?.(currentWord.word, status === 'won' ? 'mastered' : 'failed')).catch(error => console.error('Failed to save hangman word practice', error));
    }
  }, [status, finalMistakes, maxMistakes, onGameReward, onWordPractice, currentWord, sessionOwnerId]);
  const handleLetterClick = (rawLetter: string) => {
    const letter = rawLetter.toUpperCase();
    if (status !== 'playing' || guessedLetters.includes(letter) || !currentWord) return;
    const nextGuessedLetters = [...guessedLetters, letter];
    setGuessedLetters(nextGuessedLetters);
    if (!currentWord.word.includes(letter)) {
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setLiveMessage(`Буквы ${letter} нет в слове. Осталось попыток: ${Math.max(0, maxMistakes - nextMistakes)}.`);
      if (nextMistakes >= maxMistakes) { setFinalMistakes(nextMistakes); setStatus('lost'); }
      else persistActiveRound(currentWord, nextGuessedLetters, nextMistakes);
      return;
    }
    if (currentWord.word.split('').every(character => nextGuessedLetters.includes(character))) {
      setFinalMistakes(mistakes); setLiveMessage(`Буква ${letter} есть в слове. Слово угадано.`); setStatus('won');
      return;
    }
    setLiveMessage(`Буква ${letter} есть в слове.`);
    persistActiveRound(currentWord, nextGuessedLetters, mistakes);
  };
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), rewardInput: GameRewardInput = { type: 'hangman', won: status === 'won', mistakes: finalMistakes, maxMistakes };
  const rewardPreview = status === 'playing' ? null : calculateGameReward(rewardInput), progressPreview = showKidsRewards && rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null, remainingAttempts = Math.max(0, maxMistakes - finalMistakes);
  const getLetterLabel = (letter: string) => !guessedLetters.includes(letter) ? `Буква ${letter}, не выбрана` : currentWord?.word.includes(letter) ? `Буква ${letter}, есть в слове` : `Буква ${letter}, ошибка`;
  if (!dictionary.length) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  if (status !== 'playing' && rewardPreview) return <GameResultOverlay isOpen status={status === 'won' ? 'won' : 'lost'} title={status === 'won' ? 'Победа!' : 'Почти получилось'} subtitle={status === 'won' ? `Слово угадано. Осталось попыток: ${remainingAttempts}.` : 'Слово открылось — можно попробовать снова.'} emoji={status === 'won' ? '🎉' : '💪'} pet={progressPreview?.pet} xpGained={showKidsRewards ? rewardPreview.xp : 0} coinsGained={showKidsRewards ? rewardPreview.coins : 0} onPrimary={pickNewWord} onSecondary={onBack} scoreboard={<PersonalScoreboard gameId="hangman" userKey={userProfile.username} value={guessedLetters.length} direction="lower" unit="выбранных букв" record={status === 'won'} />} details={<span>Слово: <span className="font-bold">{currentWord?.word}</span>{currentWord?.translation ? ` · ${currentWord.translation}` : ''}</span>} />;
  return <div className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-3xl bg-white p-4 shadow-xl sm:p-6"><div className="sr-only" role="status" aria-live="polite">{liveMessage}</div><div className="mb-6 w-full rounded-2xl bg-indigo-50 p-4 sm:mb-8"><div className="mb-2 flex justify-center gap-1 sm:gap-2" aria-hidden="true">{Array.from({ length: maxMistakes }).map((_, index) => <motion.span key={`heart-${index}`} animate={{ opacity: index < maxMistakes - mistakes ? 1 : 0.3 }} className="text-2xl sm:text-3xl">❤️</motion.span>)}</div><div className="text-center text-xs font-bold uppercase tracking-wider text-indigo-400">Осталось попыток: {maxMistakes - mistakes}</div></div><div className="mb-8 flex flex-wrap justify-center sm:mb-12" aria-label={`Слово из ${currentWord?.word.length || 0} букв`}>{currentWord?.word.split('').map((character, index) => <div key={index} aria-label={guessedLetters.includes(character) ? `Позиция ${index + 1}: ${character}` : `Позиция ${index + 1}: скрытая буква`} className="mx-1 flex h-10 w-8 items-center justify-center border-b-4 border-indigo-600 text-2xl font-bold text-indigo-900 sm:h-12 sm:w-10 sm:text-3xl">{guessedLetters.includes(character) ? character : ''}</div>)}</div><div className="grid w-full grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label="Выбор букв">{alphabet.map(letter => <button key={letter} type="button" aria-label={getLetterLabel(letter)} disabled={guessedLetters.includes(letter)} onClick={() => handleLetterClick(letter)} className={`min-h-[2.75rem] rounded-xl text-sm font-bold transition-all sm:min-h-[2.9rem] sm:text-base ${guessedLetters.includes(letter) ? currentWord?.word.includes(letter) ? 'border-2 border-green-200 bg-green-100 text-green-600' : 'border-2 border-gray-100 bg-gray-100 text-gray-300' : 'border-2 border-gray-100 bg-white text-gray-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-50'}`}>{letter}</button>)}</div></div>;
};
