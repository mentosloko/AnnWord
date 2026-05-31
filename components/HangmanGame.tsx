import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { hasRussianTranslation, toCustomEnrichedWords } from '../services/dictionaryEngine';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { getUnusedSessionWord } from '../services/sessionWordHistory';

interface HangmanGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}

const normalizeHangmanWord = (entry: EnrichedWord): EnrichedWord | null => {
  const normalizedWord = entry.word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalizedWord || !hasRussianTranslation(entry.translation)) return null;
  return { ...entry, word: normalizedWord };
};

export const HangmanGame: React.FC<HangmanGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionarySignature = userProfile.customDictionaryEn.join('|');
  const dictionary: EnrichedWord[] = useMemo(() => {
    const sourceDictionary = userProfile.customDictionaryEn.length > 0
      ? toCustomEnrichedWords(userProfile.customDictionaryEn)
      : COMMON_WORDS_EN.filter(entry => hasRussianTranslation(entry.translation));

    return sourceDictionary
      .map(normalizeHangmanWord)
      .filter((word): word is EnrichedWord => Boolean(word));
  }, [dictionarySignature]);
  const rewardAppliedRef = useRef(false);

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [finalMistakes, setFinalMistakes] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const maxMistakes = 7;

  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    const word = getUnusedSessionWord('hangman', dictionary) || dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);
    setGuessedLetters([]);
    setMistakes(0);
    setFinalMistakes(0);
    setStatus('playing');
    rewardAppliedRef.current = false;
  }, [dictionary]);

  useEffect(() => {
    if (!currentWord) pickNewWord();
  }, [currentWord, pickNewWord]);

  useEffect(() => {
    if ((status === 'won' || status === 'lost') && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      void onGameReward({ type: 'hangman', won: status === 'won', mistakes: finalMistakes, maxMistakes });
    }
  }, [status, finalMistakes, maxMistakes, onGameReward]);

  const handleLetterClick = (rawLetter: string) => {
    const letter = rawLetter.toUpperCase();
    if (status !== 'playing' || guessedLetters.includes(letter) || !currentWord) return;

    const nextGuessedLetters = [...guessedLetters, letter];
    setGuessedLetters(nextGuessedLetters);

    if (!currentWord.word.includes(letter)) {
      setMistakes(prev => {
        const newMistakes = prev + 1;
        if (newMistakes >= maxMistakes) {
          setFinalMistakes(newMistakes);
          setStatus('lost');
        }
        return newMistakes;
      });
    } else {
      const allGuessed = currentWord.word.split('').every(char => nextGuessedLetters.includes(char));
      if (allGuessed) {
        setFinalMistakes(mistakes);
        setStatus('won');
      }
    }
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const rewardInput = { type: 'hangman' as const, won: status === 'won', mistakes: finalMistakes, maxMistakes };
  const rewardPreview = status === 'playing' ? null : calculateGameReward(rewardInput);
  const progressPreview = rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null;
  const remainingAttempts = Math.max(0, maxMistakes - finalMistakes);

  const renderWord = () => {
    if (!currentWord) return null;
    return currentWord.word.split('').map((char, index) => (
      <div key={index} className="mx-1 flex h-10 w-8 items-center justify-center border-b-4 border-indigo-600 text-2xl font-black text-indigo-900 sm:h-12 sm:w-10 sm:text-3xl">
        {guessedLetters.includes(char) || status === 'lost' ? char : ''}
      </div>
    ));
  };

  if (dictionary.length === 0) {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mb-4 text-6xl">📚</div>
        <h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2>
        <p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p>
        <button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button>
      </div>
    );
  }

  return (
    <div className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-3xl bg-white p-4 shadow-xl sm:p-6">
      <div className="mb-8 flex w-full items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 font-bold text-gray-500 transition hover:text-indigo-600"><span className="text-xl">←</span> Меню</button>
        <div className="text-sm font-bold uppercase tracking-widest text-indigo-600">Угадай слово</div>
        <div className="w-16"></div>
      </div>

      <div className="mb-8 w-full rounded-2xl bg-indigo-50 p-4">
        <div className="mb-2 flex justify-center gap-1 sm:gap-2">
          {Array.from({ length: maxMistakes }).map((_, index) => (
            <motion.span key={`heart-${index}`} animate={{ opacity: index < (maxMistakes - mistakes) ? 1 : 0.3 }} className="text-2xl sm:text-3xl">❤️</motion.span>
          ))}
        </div>
        <div className="text-center text-xs font-bold uppercase tracking-widest text-indigo-400">Осталось попыток: {maxMistakes - mistakes}</div>
      </div>

      <div className="mb-10 flex flex-wrap justify-center sm:mb-12">{renderWord()}</div>

      <div className="grid w-full grid-cols-7 gap-1.5 sm:gap-2">
        {alphabet.map(letter => (
          <button key={letter} type="button" disabled={guessedLetters.includes(letter) || status !== 'playing'} onClick={() => handleLetterClick(letter)} className={`h-9 rounded-lg text-xs font-bold transition-all sm:h-10 sm:text-sm ${guessedLetters.includes(letter) ? currentWord?.word.includes(letter) ? 'border-2 border-green-200 bg-green-100 text-green-600' : 'border-2 border-gray-100 bg-gray-100 text-gray-300' : 'border-2 border-gray-100 bg-white text-gray-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-50'}`}>
            {letter}
          </button>
        ))}
      </div>

      {rewardPreview && progressPreview && (
        <GameResultOverlay
          isOpen={status !== 'playing'}
          status={status === 'won' ? 'won' : 'lost'}
          title={status === 'won' ? 'Победа!' : 'Почти получилось'}
          subtitle={status === 'won' ? `Слово угадано. Осталось попыток: ${remainingAttempts}.` : 'Слово открылось — можно попробовать снова.'}
          emoji={status === 'won' ? '🎉' : '💪'}
          pet={progressPreview.pet}
          xpGained={rewardPreview.xp}
          coinsGained={rewardPreview.coins}
          onPrimary={pickNewWord}
          onSecondary={onBack}
          details={<span>Слово: <span className="font-black">{currentWord?.word}</span>{currentWord?.translation ? ` · ${currentWord.translation}` : ''}{status === 'won' ? ` · бонус за попытки: +${rewardPreview.coins} монет` : ''}</span>}
        />
      )}
    </div>
  );
};
