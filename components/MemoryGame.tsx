import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';

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
  onWinCoins: (coins: number) => void;
  onAddXP: (xp: number) => void;
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
  const shuffled = [...dictionary].sort(() => 0.5 - random());
  const selectedWords = shuffled.slice(0, 6);

  const gameCards: Card[] = [];
  selectedWords.forEach((wordData, index) => {
    gameCards.push({
      id: index * 2,
      content: wordData.word,
      type: 'en',
      pairId: wordData.word,
      isFlipped: false,
      isMatched: false,
    });
    gameCards.push({
      id: index * 2 + 1,
      content: wordData.translation,
      type: 'ru',
      pairId: wordData.word,
      isFlipped: false,
      isMatched: false,
    });
  });

  return gameCards.sort(() => 0.5 - random());
};

export const MemoryGame: React.FC<MemoryGameProps> = ({ onBack, userProfile, onWinCoins, onAddXP }) => {
  const dictionary = useMemo(() => buildMemoryDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);

  const initializeGame = () => {
    setCards(createMemoryCards(dictionary));
    setFlippedCards([]);
    setMoves(0);
    setIsWon(false);
  };

  useEffect(() => {
    initializeGame();
  }, [dictionary]);

  const handleCardClick = (id: number) => {
    if (flippedCards.length === 2 || cards.find(c => c.id === id)?.isFlipped || cards.find(c => c.id === id)?.isMatched) return;

    const newCards = cards.map(card => 
      card.id === id ? { ...card, isFlipped: true } : card
    );
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
          setCards(prev => prev.map(card => 
            card.pairId === firstCard?.pairId ? { ...card, isMatched: true } : card
          ));
          setFlippedCards([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(card => 
            (card.id === firstId || card.id === secondId) ? { ...card, isFlipped: false } : card
          ));
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && cards.every(card => card.isMatched) && !isWon) {
      setIsWon(true);
      onWinCoins(25);
      onAddXP(40);
    }
  }, [cards, isWon, onAddXP, onWinCoins]);

  return (
    <div className="flex flex-col items-center p-4 max-w-2xl mx-auto">
      <div className="flex justify-between w-full mb-6 items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <h2 className="text-2xl font-black text-indigo-900">Мемо</h2>
        <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-2xl shadow-sm">
          Ходы: {moves}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full">
        {cards.map(card => (
          <motion.div
            key={card.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleCardClick(card.id)}
            className={`aspect-square cursor-pointer rounded-2xl flex items-center justify-center text-center p-2 transition-all shadow-md border-4 ${
              card.isFlipped || card.isMatched 
                ? 'bg-white border-indigo-100' 
                : 'bg-indigo-600 border-indigo-700'
            }`}
          >
            {(card.isFlipped || card.isMatched) ? (
              <div className="flex flex-col items-center justify-center">
                <span className={`font-black break-words leading-tight ${card.type === 'en' ? 'text-indigo-900 text-sm sm:text-base' : 'text-pink-600 text-xs sm:text-sm'}`}>
                  {card.content}
                </span>
                <div className="mt-1 text-[8px] uppercase font-bold text-gray-300">
                  {card.type === 'en' ? 'English' : 'Русский'}
                </div>
              </div>
            ) : (
              <div className="text-white text-3xl font-black drop-shadow-sm">?</div>
            )}
          </motion.div>
        ))}
      </div>

      {isWon && (
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mt-8 p-8 bg-white rounded-[2rem] border-4 border-green-100 text-center shadow-2xl"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-2xl font-black text-green-800 mb-2">Отлично!</h3>
          <p className="text-green-600 font-bold mb-6">Ты нашёл все пары за {moves} ходов.</p>
          <div className="flex gap-3">
            <button
              onClick={initializeGame}
              className="flex-1 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 transition"
            >
              Играть снова
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition shadow-lg"
            >
              В меню
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
