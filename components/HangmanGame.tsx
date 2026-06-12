import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary, pickNextSessionWord, WordPracticeResult } from '../services/gameSessionEngine';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

interface HangmanGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
}

export const buildHangmanDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] =>
  buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary)
    .map(entry => ({ ...entry, word: entry.word.toUpperCase().replace(/[^A-Z]/g, '') }))
    .filter(entry => Boolean(entry.word));

export const HangmanGame: React.FC<HangmanGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice }) => {
  const dictionarySignature = userProfile.customDictionaryEn.join('|');
  const dictionary = useMemo(() => buildHangmanDictionary(userProfile.customDictionaryEn), [dictionarySignature]);
  const rewardAppliedRef = useRef(false);
  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [finalMistakes, setFinalMistakes] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [liveMessage, setLiveMessage] = useState('');
  const maxMistakes = 7;
  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    const word = pickNextSessionWord('hangman', dictionary) || dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);
    setGuessedLetters([]);
    setMistakes(0);
    setFinalMistakes(0);
    setStatus('playing');
    setLiveMessage('Новая игра. Выберите букву.');
    rewardAppliedRef.current = false;
  }, [dictionary]);
  useEffect(() => { if (!currentWord) pickNewWord(); }, [currentWord, pickNewWord]);
  useEffect(() => {
    if ((status === 'won' || status === 'lost') && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      void onGameReward({ type: 'hangman', won: status === 'won', mistakes: finalMistakes, maxMistakes });
      if (currentWord) void Promise.resolve(onWordPractice?.(currentWord.word, status === 'won' ? 'mastered' : 'failed')).catch(error => console.error('Failed to save hangman word practice', error));
    }
  }, [status, finalMistakes, maxMistakes, onGameReward, onWordPractice, currentWord]);
  const handleLetterClick = (rawLetter: string) => {
    const letter = rawLetter.toUpperCase();
    if (status !== 'playing' || guessedLetters.includes(letter) || !currentWord) return;
    const nextGuessedLetters = [...guessedLetters, letter];
    setGuessedLetters(nextGuessedLetters);
    if (!currentWord.word.includes(letter)) {
      setMistakes(previous => {
        const newMistakes = previous + 1;
        const remaining = Math.max(0, maxMistakes - newMistakes);
        setLiveMessage(`Буквы ${letter} нет в слове. Осталось попыток: ${remaining}.`);
        if (newMistakes >= maxMistakes) { setFinalMistakes(newMistakes); setStatus('lost'); }
        return newMistakes;
      });
    } else if (currentWord.word.split('').every(character => nextGuessedLetters.includes(character))) {
      setFinalMistakes(mistakes);
      setLiveMessage(`Буква ${letter} есть в слове. Слово угадано.`);
      setStatus('won');
    } else {
      setLiveMessage(`Буква ${letter} есть в слове.`);
    }
  };
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const rewardInput: GameRewardInput = { type: 'hangman', won: status === 'won', mistakes: finalMistakes, maxMistakes };
  const rewardPreview = status === 'playing' ? null : calculateGameReward(rewardInput);
  const progressPreview = rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null;
  const remainingAttempts = Math.max(0, maxMistakes - finalMistakes);
  const getLetterLabel = (letter: string) => {
    if (!guessedLetters.includes(letter)) return `Буква ${letter}, не выбрана`;
    if (currentWord?.word.includes(letter)) return `Буква ${letter}, есть в слове`;
    return `Буква ${letter}, ошибка`;
  };

  if (dictionary.length === 0) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;

  if (status !== 'playing' && rewardPreview && progressPreview) {
    return <GameResultOverlay isOpen status={status === 'won' ? 'won' : 'lost'} title={status === 'won' ? 'Победа!' : 'Почти получилось'} subtitle={status === 'won' ? `Слово угадано. Осталось попыток: ${remainingAttempts}.` : 'Слово открылось — можно попробовать снова.'} emoji={status === 'won' ? '🎉' : '💪'} pet={progressPreview.pet} xpGained={rewardPreview.xp} coinsGained={rewardPreview.coins} onPrimary={pickNewWord} onSecondary={onBack} details={<span>Слово: <span className="font-black">{currentWord?.word}</span>{currentWord?.translation ? ` · ${currentWord.translation}` : ''}<br /><span>Опыт начисляется за завершённую тренировку, даже если слово не угадано.</span>{status === 'won' && rewardPreview.coins > 0 ? <><br /><span>Бонус за попытки: +{rewardPreview.coins} монет.</span></> : null}</span>} />;
  }

  return (
    <div className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-3xl bg-white p-4 shadow-xl sm:p-6">
      <div className="sr-only" role="status" aria-live="polite">{liveMessage}</div>
      <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-2 sm:mb-8"><button type="button" onClick={onBack} className="flex min-h-[2.6rem] items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 font-bold text-gray-500 transition hover:text-indigo-600"><span className="text-xl" aria-hidden="true">←</span> Меню</button><div className="text-sm font-bold uppercase tracking-widest text-indigo-600">Угадай слово</div><div className="w-10" /></div>
      <div className="mb-6 w-full rounded-2xl bg-indigo-50 p-4 sm:mb-8"><div className="mb-2 flex justify-center gap-1 sm:gap-2" aria-hidden="true">{Array.from({ length: maxMistakes }).map((_, index) => <motion.span key={`heart-${index}`} animate={{ opacity: index < maxMistakes - mistakes ? 1 : 0.3 }} className="text-2xl sm:text-3xl">❤️</motion.span>)}</div><div className="text-center text-xs font-bold uppercase tracking-widest text-indigo-400">Осталось попыток: {maxMistakes - mistakes}</div></div>
      <div className="mb-8 flex flex-wrap justify-center sm:mb-12" aria-label={`Слово из ${currentWord?.word.length || 0} букв`}>{currentWord?.word.split('').map((character, index) => <div key={index} aria-label={guessedLetters.includes(character) ? `Позиция ${index + 1}: ${character}` : `Позиция ${index + 1}: скрытая буква`} className="mx-1 flex h-10 w-8 items-center justify-center border-b-4 border-indigo-600 text-2xl font-black text-indigo-900 sm:h-12 sm:w-10 sm:text-3xl">{guessedLetters.includes(character) ? character : ''}</div>)}</div>
      <div className="grid w-full grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label="Выбор букв">{alphabet.map(letter => <button key={letter} type="button" aria-label={getLetterLabel(letter)} disabled={guessedLetters.includes(letter)} onClick={() => handleLetterClick(letter)} className={`min-h-[2.75rem] rounded-xl text-sm font-black transition-all sm:min-h-[2.9rem] sm:text-base ${guessedLetters.includes(letter) ? currentWord?.word.includes(letter) ? 'border-2 border-green-200 bg-green-100 text-green-600' : 'border-2 border-gray-100 bg-gray-100 text-gray-300' : 'border-2 border-gray-100 bg-white text-gray-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-50'}`}>{letter}</button>)}</div>
    </div>
  );
};
