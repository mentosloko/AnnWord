import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { getUnusedSessionWord } from '../services/sessionWordHistory';

interface Card {
  id: number;
  content: string;
  type: 'en' | 'ru';
  pairId: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface MemoryGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}

export const buildMemoryDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => {
  const translationByWord = new Map(
    fallbackDictionary
      .filter(entry => entry.word && entry.translation)
      .map(entry => [entry.word.toUpperCase(), entry]),
  );

  const customWordsWithTranslations = customDictionaryEn
    .map(word => translationByWord.get(word.trim().toUpperCase()))
    .filter((entry): entry is EnrichedWord => Boolean(entry?.translation));

  return customWordsWithTranslations.length >= 6
    ? customWordsWithTranslations
    : fallbackDictionary.filter(entry => Boolean(entry.translation));
};

export const createMemoryCards = (dictionary: EnrichedWord[], random: () => number = Math.random): Card[] => {
  const selectedWords: EnrichedWord[] = [];
  const selectedSet = new Set<string>();
  const maxPairs = Math.min(6, dictionary.length);

  while (selectedWords.length < maxPairs) {
    const selected = getUnusedSessionWord('memory', dictionary);
    if (!selected) break;
    const key = selected.word.toUpperCase();
    if (selectedSet.has(key)) break;
    selectedSet.add(key);
    selectedWords.push(selected);
  }

  if (selectedWords.length < maxPairs) {
    const shuffled = [...dictionary].sort(() => 0.5 - random());
    for (const word of shuffled) {
      if (selectedWords.length >= maxPairs) break;
      const key = word.word.toUpperCase();
      if (selectedSet.has(key)) continue;
      selectedSet.add(key);
      selectedWords.push(word);
    }
  }

  const gameCards: Card[] = [];
  selectedWords.forEach((wordData, index) => {
    gameCards.push({ id: index * 2, content: wordData.word, type: 'en', pairId: wordData.word, isFlipped: false, isMatched: false });
    gameCards.push({ id: index * 2 + 1, content: wordData.translation, type: 'ru', pairId: wordData.word, isFlipped: false, isMatched: false });
  });

  return gameCards.sort(() => 0.5 - random());
};

export const MemoryGame: React.FC<MemoryGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionarySignature = userProfile.customDictionaryEn.join('|');
  const dictionary = useMemo(() => buildMemoryDictionary(userProfile.customDictionaryEn), [dictionarySignature]);
  const rewardAppliedRef = useRef(false);

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [isWon, setIsWon] = useState(false);

  const initializeGame = useCallback(() => {
    setCards(createMemoryCards(dictionary));
    setFlippedCards([]);
    setMoves(0);
    setClicks(0);
    setIsWon(false);
    rewardAppliedRef.current = false;
  }, [dictionary]);

  useEffect(() => {
    if (cards.length === 0) initializeGame();
  }, [cards.length, initializeGame]);

  const handleCardClick = (id: number) => {
    if (isWon || flippedCards.length === 2 || cards.find(c => c.id === id)?.isFlipped || cards.find(c => c.id === id)?.isMatched) return;

    setClicks(prev => prev + 1);
    const newCards = cards.map(card => card.id === id ? { ...card, isFlipped: true } : card);
    setCards(newCards);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = newCards.find(c => c.id === firstId);
      const secondCard = newCards.find(c => c.id === secondId);

      if (firstCard?.pairId === secondCard?.pairId) {
        setTimeout(() => {
          setCards(prev => prev.map(card => card.pairId === firstCard?.pairId ? { ...card, isMatched: true } : card));
          setFlippedCards([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(card => (card.id === firstId || card.id === secondId) ? { ...card, isFlipped: false } : card));
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && cards.every(card => card.isMatched) && !isWon) setIsWon(true);
  }, [cards, isWon]);

  useEffect(() => {
    if (isWon && !rewardAppliedRef.current) {
      rewardAppliedRef.current = true;
      void onGameReward({ type: 'memory', clicks });
    }
  }, [isWon, clicks, onGameReward]);

  const rewardPreview = calculateGameReward({ type: 'memory', clicks });
  const progressPreview = applyGameRewardToCharacter(userProfile.pet, rewardPreview);

  return (
    <div className="flex flex-col items-center p-3 sm:p-4 max-w-2xl mx-auto w-full">
      <div className="flex justify-between w-full mb-6 items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-xl">←</span> Меню
        </button>
        <h2 className="text-2xl font-black text-indigo-900">Мемо</h2>
        <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 sm:px-4 py-1.5 rounded-2xl shadow-sm">Кликов: {clicks}</div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 w-full">
        {cards.map(card => (
          <motion.div key={card.id} whileHover={{ scale: isWon ? 1 : 1.05 }} whileTap={{ scale: isWon ? 1 : 0.95 }} onClick={() => handleCardClick(card.id)} className={`aspect-square cursor-pointer rounded-2xl flex items-center justify-center text-center p-2 transition-all shadow-md border-4 ${card.isFlipped || card.isMatched ? 'bg-white border-indigo-100' : 'bg-indigo-600 border-indigo-700'}`}>
            {(card.isFlipped || card.isMatched) ? (
              <div className="flex flex-col items-center justify-center min-w-0">
                <span className={`font-black break-words leading-tight ${card.type === 'en' ? 'text-indigo-900 text-xs sm:text-base' : 'text-pink-600 text-[11px] sm:text-sm'}`}>{card.content}</span>
                <div className="mt-1 text-[8px] uppercase font-bold text-gray-300">{card.type === 'en' ? 'English' : 'Русский'}</div>
              </div>
            ) : <div className="text-white text-3xl font-black drop-shadow-sm">?</div>}
          </motion.div>
        ))}
      </div>

      <GameResultOverlay isOpen={isWon} status="won" title="Отлично!" subtitle={`Ты нашёл все пары за ${clicks} кликов.`} emoji="🎉" pet={progressPreview.pet} xpGained={rewardPreview.xp} coinsGained={rewardPreview.coins} onPrimary={initializeGame} onSecondary={onBack} details={<span>Ходов: {moves}</span>} />
    </div>
  );
};
