import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary, pickNextSessionWord } from '../services/gameSessionEngine';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

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

export const buildMemoryDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] =>
  buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);

export const createMemoryCards = (dictionary: EnrichedWord[], random: () => number = Math.random): Card[] => {
  const selectedWords: EnrichedWord[] = [];
  const selectedSet = new Set<string>();
  const maxPairs = Math.min(6, dictionary.length);

  while (selectedWords.length < maxPairs) {
    const selected = pickNextSessionWord('memory', dictionary);
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

  useEffect(() => { if (cards.length === 0 && dictionary.length > 0) initializeGame(); }, [cards.length, dictionary.length, initializeGame]);

  const handleCardClick = (id: number) => {
    if (isWon || flippedCards.length === 2 || cards.find(card => card.id === id)?.isFlipped || cards.find(card => card.id === id)?.isMatched) return;
    setClicks(previous => previous + 1);
    const newCards = cards.map(card => card.id === id ? { ...card, isFlipped: true } : card);
    setCards(newCards);
    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);
    if (newFlipped.length === 2) {
      setMoves(previous => previous + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = newCards.find(card => card.id === firstId);
      const secondCard = newCards.find(card => card.id === secondId);
      if (firstCard?.pairId === secondCard?.pairId) {
        setTimeout(() => { setCards(previous => previous.map(card => card.pairId === firstCard?.pairId ? { ...card, isMatched: true } : card)); setFlippedCards([]); }, 500);
      } else {
        setTimeout(() => { setCards(previous => previous.map(card => (card.id === firstId || card.id === secondId) ? { ...card, isFlipped: false } : card)); setFlippedCards([]); }, 1000);
      }
    }
  };

  useEffect(() => { if (cards.length > 0 && cards.every(card => card.isMatched) && !isWon) setIsWon(true); }, [cards, isWon]);
  useEffect(() => { if (isWon && !rewardAppliedRef.current) { rewardAppliedRef.current = true; void onGameReward({ type: 'memory', clicks }); } }, [isWon, clicks, onGameReward]);

  const rewardPreview = calculateGameReward({ type: 'memory', clicks });
  const progressPreview = applyGameRewardToCharacter(userProfile.pet, rewardPreview);

  if (dictionary.length === 0) {
    return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center p-3 sm:p-4">
      <div className="mb-6 flex w-full items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 font-bold text-gray-500 transition hover:text-indigo-600"><span className="text-xl">←</span> Меню</button>
        <h2 className="text-2xl font-black text-indigo-900">Память</h2>
        <div className="rounded-2xl bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 shadow-sm sm:px-4">Кликов: {clicks}</div>
      </div>
      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {cards.map(card => (
          <motion.div key={card.id} whileHover={{ scale: isWon ? 1 : 1.05 }} whileTap={{ scale: isWon ? 1 : 0.95 }} onClick={() => handleCardClick(card.id)} className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-4 p-2 text-center shadow-md transition-all ${card.isFlipped || card.isMatched ? 'border-indigo-100 bg-white' : 'border-indigo-700 bg-indigo-600'}`}>
            {(card.isFlipped || card.isMatched) ? <div className="flex min-w-0 flex-col items-center justify-center"><span className={`break-words font-black leading-tight ${card.type === 'en' ? 'text-xs text-indigo-900 sm:text-base' : 'text-[11px] text-pink-600 sm:text-sm'}`}>{card.content}</span><div className="mt-1 text-[8px] font-bold uppercase text-gray-300">{card.type === 'en' ? 'Английский' : 'Русский'}</div></div> : <div className="text-3xl font-black text-white drop-shadow-sm">?</div>}
          </motion.div>
        ))}
      </div>
      <GameResultOverlay isOpen={isWon} status="won" title="Отлично!" subtitle={`Ты нашёл все пары за ${clicks} кликов.`} emoji="🎉" pet={progressPreview.pet} xpGained={rewardPreview.xp} coinsGained={rewardPreview.coins} onPrimary={initializeGame} onSecondary={onBack} details={<span>Ходов: {moves}</span>} />
    </div>
  );
};