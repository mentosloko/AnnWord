import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary } from '../services/gameSessionEngine';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

interface MemoryGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
}
interface Card { id: number; content: string; type: 'en' | 'ru'; pairId: number; isFlipped: boolean; isMatched: boolean; }
export const buildMemoryDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);
const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);
const createMemoryCards = (dictionary: EnrichedWord[]): Card[] => {
  const selectedWords = shuffle(dictionary).slice(0, Math.min(6, dictionary.length));
  return shuffle(selectedWords.flatMap((word, pairId) => [
    { id: pairId * 2, content: word.word, type: 'en' as const, pairId, isFlipped: false, isMatched: false },
    { id: pairId * 2 + 1, content: word.translation, type: 'ru' as const, pairId, isFlipped: false, isMatched: false },
  ]));
};

export const MemoryGame: React.FC<MemoryGameProps> = ({ onBack, userProfile, onGameReward }) => {
  const dictionary = useMemo(() => buildMemoryDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
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
    const selectedCard = cards.find(card => card.id === id);
    if (isWon || flippedCards.length === 2 || selectedCard?.isFlipped || selectedCard?.isMatched) return;
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
      if (firstCard?.pairId === secondCard?.pairId) setTimeout(() => { setCards(previous => previous.map(card => card.pairId === firstCard?.pairId ? { ...card, isMatched: true } : card)); setFlippedCards([]); }, 550);
      else setTimeout(() => { setCards(previous => previous.map(card => (card.id === firstId || card.id === secondId) ? { ...card, isFlipped: false } : card)); setFlippedCards([]); }, 1200);
    }
  };
  useEffect(() => { if (cards.length > 0 && cards.every(card => card.isMatched) && !isWon) setIsWon(true); }, [cards, isWon]);
  useEffect(() => { if (isWon && !rewardAppliedRef.current) { rewardAppliedRef.current = true; void onGameReward({ type: 'memory', clicks }); } }, [isWon, clicks, onGameReward]);
  const rewardPreview = calculateGameReward({ type: 'memory', clicks });
  const progressPreview = applyGameRewardToCharacter(userProfile.pet, rewardPreview);
  if (dictionary.length === 0) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center p-3 sm:p-4">
      <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 sm:mb-6"><button onClick={onBack} className="flex min-h-[2.6rem] items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 font-bold text-gray-500 transition hover:text-indigo-600"><span className="text-xl">←</span> Меню</button><h2 className="text-2xl font-black text-indigo-900">Память</h2><div className="rounded-2xl bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 shadow-sm sm:px-4">Кликов: {clicks}</div></div>
      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3" role="grid" aria-label="Карточки памяти: найдите пары слово-перевод">{cards.map(card => {
        const isOpen = card.isFlipped || card.isMatched;
        const label = card.isMatched ? `Найденная пара: ${card.content}` : isOpen ? `Открытая карточка: ${card.content}. ${card.type === 'en' ? 'Английское слово' : 'Русский перевод'}` : 'Закрытая карточка. Открыть';
        return <motion.button key={card.id} type="button" role="gridcell" aria-label={label} aria-pressed={isOpen} disabled={isWon || card.isMatched} animate={card.isMatched ? { scale: [1, 1.06, 1] } : undefined} whileHover={{ scale: isWon ? 1 : 1.05 }} whileTap={{ scale: isWon ? 1 : 0.95 }} onClick={() => handleCardClick(card.id)} className={`flex aspect-square min-h-[5rem] cursor-pointer items-center justify-center rounded-2xl border-4 p-2 text-center shadow-md transition-all disabled:cursor-default ${card.isMatched ? 'border-green-200 bg-green-50' : isOpen ? 'border-indigo-100 bg-white' : 'border-indigo-700 bg-indigo-600'}`}>{isOpen ? <div className="flex min-w-0 flex-col items-center justify-center"><span className={`break-words font-black leading-tight ${card.type === 'en' ? 'text-xs text-indigo-900 sm:text-base' : 'text-[11px] text-pink-600 sm:text-sm'}`}>{card.content}</span><div className="mt-1 text-[8px] font-bold uppercase text-gray-300">{card.type === 'en' ? 'Английский' : 'Русский'}</div></div> : <div className="text-3xl font-black text-white drop-shadow-sm" aria-hidden="true">?</div>}</motion.button>;
      })}</div>
      <GameResultOverlay isOpen={isWon} status="won" title="Отлично!" subtitle={`Ты нашёл все пары за ${clicks} кликов.`} emoji="🎉" pet={progressPreview.pet} xpGained={rewardPreview.xp} coinsGained={rewardPreview.coins} onPrimary={initializeGame} onSecondary={onBack} details={<span>Ходов: {moves}</span>} />
    </div>
  );
};
