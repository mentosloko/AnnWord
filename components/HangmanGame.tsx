import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

interface HangmanGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}

const normalizeHangmanWord = (entry: EnrichedWord): EnrichedWord | null => {
  const normalizedWord = entry.word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalizedWord) return null;
  return { ...entry, word: normalizedWord };
};

export const HangmanGame: React.FC<HangmanGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionary: EnrichedWord[] = useMemo(() => {
    const sourceDictionary: EnrichedWord[] = userProfile.customDictionaryEn && userProfile.customDictionaryEn.length > 0
      ? userProfile.customDictionaryEn.map(w => ({ word: w, translation: '', level: 'Custom' }))
      : COMMON_WORDS_EN;

    return sourceDictionary
      .map(normalizeHangmanWord)
      .filter((word): word is EnrichedWord => Boolean(word));
  }, [userProfile.customDictionaryEn]);
  const rewardAppliedRef = useRef(false);

  const [currentWord, setCurrentWord] = useState<EnrichedWord | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const maxMistakes = 7;

  const pickNewWord = useCallback(() => {
    if (dictionary.length === 0) return;
    const word = dictionary[Math.floor(Math.random() * dictionary.length)];
    setCurrentWord(word);
    setGuessedLetters([]);
    setMistakes(0);
    setStatus('playing');
    rewardAppliedRef.current = false;
  }, [dictionary]);

  useEffect(() => {
    pickNewWord();
  }, [pickNewWord]);

  useEffect(() => {
    if ((status === 'won' || status === 'lost') && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      void onGameReward({ type: 'hangman', won: status === 'won' });
    }
  }, [status, onGameReward]);

  const handleLetterClick = (rawLetter: string) => {
    const letter = rawLetter.toUpperCase();
    if (status !== 'playing' || guessedLetters.includes(letter) || !currentWord) return;

    const nextGuessedLetters = [...guessedLetters, letter];
    setGuessedLetters(nextGuessedLetters);

    if (!currentWord.word.includes(letter)) {
      setMistakes(prev => {
        const newMistakes = prev + 1;
        if (newMistakes >= maxMistakes) {
          setStatus('lost');
        }
        return newMistakes;
      });
    } else {
      const allGuessed = currentWord.word.split('').every(char => nextGuessedLetters.includes(char));
      if (allGuessed) {
        setStatus('won');
      }
    }
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const rewardPreview = status === 'playing' ? null : calculateGameReward({ type: 'hangman', won: status === 'won' });
  const progressPreview = rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null;

  const renderWord = () => {
    if (!currentWord) return null;
    return currentWord.word.split('').map((char, i) => (
      <div key={i} className="h-[clamp(2.6rem,8dvh,4rem)] min-w-[clamp(2rem,10vw,3.2rem)] border-b-4 border-indigo-600 flex items-center justify-center text-[clamp(1.6rem,8vw,2.7rem)] font-black text-indigo-900 mx-0.5 sm:mx-1">
        {guessedLetters.includes(char) || status === 'lost' ? char : ''}
      </div>
    ));
  };

  if (dictionary.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-3xl w-full max-w-md">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold mb-2">Словарь пуст!</h2>
        <p className="text-gray-500 mb-6">Выбери другой словарь в настройках.</p>
        <button type="button" onClick={onBack} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold">Назад</button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-xl flex-col items-center justify-between gap-3 overflow-hidden">
      <div className="w-full shrink-0 rounded-3xl bg-indigo-50 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-black text-indigo-800">Ошибки: {mistakes}/{maxMistakes}</div>
          <button
            type="button"
            onClick={pickNewWord}
            className="rounded-2xl bg-white border-2 border-indigo-100 px-3 py-2 text-sm font-black text-indigo-700"
          >
            Новое
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: maxMistakes }).map((_, i) => (
            <motion.div
              key={`life-${i}`}
              animate={{ opacity: i < (maxMistakes - mistakes) ? 1 : 0.25, scale: i < (maxMistakes - mistakes) ? 1 : 0.9 }}
              className="h-3 rounded-full bg-red-400"
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 w-full">
        <div className="flex justify-center flex-wrap max-w-full px-1">
          {renderWord()}
        </div>
        {currentWord?.translation && status !== 'playing' && (
          <div className="rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">
            {currentWord.translation}
          </div>
        )}
      </div>

      <div className="grid w-full grid-cols-7 gap-1.5 sm:gap-2 shrink-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {alphabet.map(letter => {
          const isGuessed = guessedLetters.includes(letter);
          const isCorrect = currentWord?.word.includes(letter);
          return (
            <button
              key={letter}
              type="button"
              aria-label={`Буква ${letter}`}
              disabled={isGuessed || status !== 'playing'}
              onClick={() => handleLetterClick(letter)}
              className={`h-[clamp(2.55rem,6.8dvh,3.4rem)] rounded-2xl border-2 text-[clamp(0.95rem,4vw,1.25rem)] font-black shadow-sm transition-all touch-manipulation active:scale-95 ${
                isGuessed
                  ? isCorrect
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-gray-200 text-gray-400 border-gray-200'
                  : 'bg-white border-indigo-100 text-indigo-950 hover:bg-indigo-50'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {rewardPreview && progressPreview && (
        <GameResultOverlay
          isOpen={status !== 'playing'}
          status={status === 'won' ? 'won' : 'lost'}
          title={status === 'won' ? 'Победа!' : 'Почти получилось'}
          subtitle={status === 'won' ? 'Слово угадано по буквам.' : 'Слово открылось — можно попробовать снова.'}
          emoji={status === 'won' ? '🎉' : '💪'}
          pet={progressPreview.pet}
          xpGained={rewardPreview.xp}
          coinsGained={rewardPreview.coins}
          onPrimary={pickNewWord}
          onSecondary={onBack}
          details={(
            <span>
              Слово: <span className="font-black">{currentWord?.word}</span>
              {currentWord?.translation ? ` · ${currentWord.translation}` : ''}
            </span>
          )}
        />
      )}
    </div>
  );
};