import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EnrichedWord } from '../types';
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
  onWin: (coins: number) => void;
  onClose: () => void;
}

export const MemoryGame: React.FC<MemoryGameProps> = ({ onWin, onClose }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    // Select 6 random words from dictionary
    const shuffled = [...COMMON_WORDS_EN].sort(() => 0.5 - Math.random());
    const selectedWords = shuffled.slice(0, 6);

    const gameCards: Card[] = [];
    selectedWords.forEach((wordData, index) => {
      // English word card
      gameCards.push({
        id: index * 2,
        content: wordData.word,
        type: 'en',
        pairId: wordData.word,
        isFlipped: false,
        isMatched: false,
      });
      // Russian translation card
      gameCards.push({
        id: index * 2 + 1,
        content: wordData.translation,
        type: 'ru',
        pairId: wordData.word,
        isFlipped: false,
        isMatched: false,
      });
    });

    setCards(gameCards.sort(() => 0.5 - Math.random()));
    setFlippedCards([]);
    setMoves(0);
    setIsWon(false);
  };

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
        // Match!
        setTimeout(() => {
          setCards(prev => prev.map(card => 
            card.pairId === firstCard?.pairId ? { ...card, isMatched: true } : card
          ));
          setFlippedCards([]);
        }, 500);
      } else {
        // No match
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
      onWin(25); // Award 25 coins
    }
  }, [cards, isWon]);

  return (
    <div className="flex flex-col items-center p-4 max-w-2xl mx-auto">
      <div className="flex justify-between w-full mb-6 items-center">
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
          <p className="text-green-600 font-bold mb-6">Ты нашел все пары за {moves} ходов.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={initializeGame}
              className="bg-green-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-green-600 transition shadow-lg transform active:scale-95"
            >
              Играть снова
            </button>
            <button 
              onClick={onClose}
              className="bg-white text-gray-500 border-2 border-gray-200 px-8 py-3 rounded-2xl font-bold hover:bg-gray-50 transition transform active:scale-95"
            >
              В меню
            </button>
          </div>
        </motion.div>
      )}

      {!isWon && (
        <button 
          onClick={onClose}
          className="mt-8 text-indigo-400 font-bold hover:text-indigo-600 transition flex items-center gap-2 bg-white px-6 py-2 rounded-xl shadow-sm border border-indigo-50"
        >
          <span>←</span> Выйти из игры
        </button>
      )}
    </div>
  );
};
