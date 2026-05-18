import React, { useState, useEffect, useCallback, useRef } from 'react';
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

export const HangmanGame: React.FC<HangmanGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionary: EnrichedWord[] = userProfile.customDictionaryEn && userProfile.customDictionaryEn.length > 0
    ? userProfile.customDictionaryEn.map(w => ({ word: w.toUpperCase(), translation: '', level: 'Custom' }))
    : COMMON_WORDS_EN;
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

  const handleLetterClick = (letter: string) => {
    if (status !== 'playing' || guessedLetters.includes(letter)) return;
    
    const nextGuessedLetters = [...guessedLetters, letter];
    setGuessedLetters(nextGuessedLetters);
    
    if (!currentWord?.word.includes(letter)) {
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
      <div key={i} className="w-8 h-10 sm:w-10 sm:h-12 border-b-4 border-indigo-600 flex items-center justify-center text-2xl sm:text-3xl font-black text-indigo-900 mx-1">
        {guessedLetters.includes(char) || status === 'lost' ? char : ''}
      </div>
    ));
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
      <div className="w-full flex justify-between items-center mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Угадай слово</div>
        <div className="w-16"></div>
      </div>

      <div className="w-full bg-indigo-50 rounded-2xl p-4 mb-8">
        <div className="flex justify-center gap-1 sm:gap-2 mb-2">
          {Array.from({ length: maxMistakes }).map((_, i) => (
            <motion.span
              key={`heart-${i}`}
              animate={{ opacity: i < (maxMistakes - mistakes) ? 1 : 0.3 }}
              className="text-2xl sm:text-3xl"
            >
              ❤️
            </motion.span>
          ))}
        </div>
        <div className="text-center text-xs font-bold text-indigo-400 uppercase tracking-widest">
          Осталось попыток: {maxMistakes - mistakes}
        </div>
      </div>

      <div className="flex justify-center mb-10 sm:mb-12 flex-wrap">
        {renderWord()}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 w-full">
        {alphabet.map(letter => (
          <button
            key={letter}
            disabled={guessedLetters.includes(letter) || status !== 'playing'}
            onClick={() => handleLetterClick(letter)}
            className={`h-9 sm:h-10 rounded-lg font-bold text-xs sm:text-sm transition-all ${
              guessedLetters.includes(letter)
                ? currentWord?.word.includes(letter)
                  ? 'bg-green-100 text-green-600 border-2 border-green-200'
                  : 'bg-gray-100 text-gray-300 border-2 border-gray-100'
                : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 shadow-sm'
            }`}
          >
            {letter}
          </button>
        ))}
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