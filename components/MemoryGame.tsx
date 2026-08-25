import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary, WordPracticeResult } from '../services/gameSessionEngine';
import { clearPersistedGameSession, isPersistedSessionFor, persistGameSession, readPersistedGameSession } from '../services/gameSessionStore';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { PersonalScoreboard } from './PersonalScoreboard';
import { applyGameRewardToCharacter, calculateGameReward, CharacterProgressResult, GameRewardInput } from '../services/gamificationRules';
import { isKidsMode } from '../services/modeFlags';

interface MemoryGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
  sessionOwnerId?: string | null;
  dictionaryId?: string;
  dictionaryLabel?: string;
  dictionaryIcon?: string;
}
interface Card { id: number; content: string; type: 'en' | 'ru'; pairId: number; isFlipped: boolean; isMatched: boolean; }
interface SavedMemoryState { cards: Card[]; flippedCards: number[]; moves: number; }
export const buildMemoryDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);
const shuffle = <T,>(items: T[], random: () => number = Math.random): T[] => [...items].sort(() => random() - 0.5);
export const createMemoryCards = (dictionary: EnrichedWord[], random: () => number = Math.random): Card[] => { const selectedWords = shuffle(dictionary, random).slice(0, Math.min(6, dictionary.length)); return shuffle(selectedWords.flatMap((word, pairId) => [{ id: pairId * 2, content: word.word, type: 'en' as const, pairId, isFlipped: false, isMatched: false }, { id: pairId * 2 + 1, content: word.translation, type: 'ru' as const, pairId, isFlipped: false, isMatched: false }]), random); };
const moveWord = (moves: number): string => { const mod100 = moves % 100, mod10 = moves % 10; return mod100 >= 11 && mod100 <= 14 ? 'ходов' : mod10 === 1 ? 'ход' : mod10 >= 2 && mod10 <= 4 ? 'хода' : 'ходов'; };
const normalizeSavedState = (value: unknown, dictionary: EnrichedWord[]): SavedMemoryState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<SavedMemoryState>;
  if (!Array.isArray(raw.cards) || raw.cards.length < 2 || raw.cards.length % 2 !== 0) return null;
  const allowed = new Set(dictionary.flatMap(entry => [entry.word, entry.translation]));
  const cards = raw.cards.filter((card): card is Card => Boolean(card) && typeof card.id === 'number' && typeof card.pairId === 'number' && (card.type === 'en' || card.type === 'ru') && typeof card.content === 'string' && typeof card.isFlipped === 'boolean' && typeof card.isMatched === 'boolean');
  if (cards.length !== raw.cards.length || cards.some(card => !allowed.has(card.content))) return null;
  const ids = new Set(cards.map(card => card.id));
  const flippedCards = Array.isArray(raw.flippedCards) ? raw.flippedCards.filter((id): id is number => typeof id === 'number' && ids.has(id)).slice(0, 2) : [];
  return { cards, flippedCards, moves: Math.max(0, Number(raw.moves) || 0) };
};

export const MemoryGame: React.FC<MemoryGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice, sessionOwnerId, dictionaryId = 'live', dictionaryLabel, dictionaryIcon }) => {
  const dictionary = useMemo(() => buildMemoryDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const restored = useMemo(() => {
    const session = readPersistedGameSession(sessionOwnerId);
    return isPersistedSessionFor(session, 'memory', dictionaryId) ? normalizeSavedState(session?.state, dictionary) : null;
  }, [dictionary, dictionaryId, sessionOwnerId]);
  const rewardAppliedRef = useRef(false), timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [cards, setCards] = useState<Card[]>(restored?.cards || []), [flippedCards, setFlippedCards] = useState<number[]>(restored?.flippedCards || []), [moves, setMoves] = useState(restored?.moves || 0), [isWon, setIsWon] = useState(false);
  const [resultProgress, setResultProgress] = useState<CharacterProgressResult | null>(null), showKidsRewards = isKidsMode(userProfile);
  const clearTimers = useCallback(() => { timeoutIdsRef.current.forEach(id => clearTimeout(id)); timeoutIdsRef.current = []; }, []);
  const initializeGame = useCallback(() => { clearPersistedGameSession(sessionOwnerId, 'memory'); clearTimers(); setCards(createMemoryCards(dictionary)); setFlippedCards([]); setMoves(0); setIsWon(false); setResultProgress(null); rewardAppliedRef.current = false; }, [clearTimers, dictionary, sessionOwnerId]);
  useEffect(() => { if (cards.length === 0 && dictionary.length > 0) initializeGame(); }, [cards.length, dictionary.length, initializeGame]);
  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => {
    if (!sessionOwnerId || !cards.length || isWon) return;
    persistGameSession(sessionOwnerId, {
      gameType: 'memory',
      dictionaryId,
      dictionaryWords: dictionary.map(entry => entry.word),
      dictionaryLabel,
      dictionaryIcon,
      state: { cards, flippedCards, moves },
      score: { moves, matchedPairs: new Set(cards.filter(card => card.isMatched).map(card => card.pairId)).size },
      rewardState: 'active',
    });
  }, [cards, dictionary, dictionaryIcon, dictionaryId, dictionaryLabel, flippedCards, isWon, moves, sessionOwnerId]);
  const handleCardClick = (id: number) => { const selectedCard = cards.find(card => card.id === id); if (isWon || flippedCards.length === 2 || selectedCard?.isFlipped || selectedCard?.isMatched) return; const newCards = cards.map(card => card.id === id ? { ...card, isFlipped: true } : card); setCards(newCards); const newFlipped = [...flippedCards, id]; setFlippedCards(newFlipped); if (newFlipped.length !== 2) return; setMoves(value => value + 1); const [firstId, secondId] = newFlipped, firstCard = newCards.find(card => card.id === firstId), secondCard = newCards.find(card => card.id === secondId); if (firstCard?.pairId === secondCard?.pairId) { const englishCard = newCards.find(card => card.pairId === firstCard?.pairId && card.type === 'en'); const timer = setTimeout(() => { setCards(previous => previous.map(card => card.pairId === firstCard?.pairId ? { ...card, isMatched: true } : card)); setFlippedCards([]); if (englishCard) void Promise.resolve(onWordPractice?.(englishCard.content, 'mastered')).catch(error => console.error('Failed to save Memory word progress', error)); }, 550); timeoutIdsRef.current.push(timer); } else { const timer = setTimeout(() => { setCards(previous => previous.map(card => card.id === firstId || card.id === secondId ? { ...card, isFlipped: false } : card)); setFlippedCards([]); }, 1200); timeoutIdsRef.current.push(timer); } };
  useEffect(() => { if (cards.length > 0 && cards.every(card => card.isMatched) && !isWon) setIsWon(true); }, [cards, isWon]);
  useEffect(() => { if (isWon) clearPersistedGameSession(sessionOwnerId, 'memory'); }, [isWon, sessionOwnerId]);
  useEffect(() => { if (!isWon || rewardAppliedRef.current) return; rewardAppliedRef.current = true; const reward = calculateGameReward({ type: 'memory', moves }); setResultProgress(showKidsRewards ? applyGameRewardToCharacter(userProfile.pet, reward) : null); void Promise.resolve(onGameReward({ type: 'memory', moves })).catch(error => console.error('Failed to save Memory completion', error)); }, [isWon, moves, onGameReward, showKidsRewards, userProfile.pet]);
  const rewardPreview = calculateGameReward({ type: 'memory', moves });
  if (dictionary.length === 0) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">В выбранном словаре нет слов с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  return <div className="mx-auto flex w-full max-w-2xl flex-col items-center p-3 sm:p-4"><div className="mb-4 flex w-full justify-end sm:mb-6"><div className="rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600">Ходов: {moves}</div></div><div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3" role="grid" aria-label="Карточки памяти: найдите пары слово-перевод">{cards.map((card, index) => { const isOpen = card.isFlipped || card.isMatched; const label = card.isMatched ? `Карточка ${index + 1}. Найденная пара: ${card.content}` : isOpen ? `Карточка ${index + 1}. Открытая карточка: ${card.content}` : `Карточка ${index + 1}. Закрытая карточка. Открыть`; return <motion.button key={card.id} type="button" aria-label={label} aria-pressed={isOpen} disabled={isWon || card.isMatched} animate={card.isMatched ? { scale: [1, 1.06, 1] } : undefined} whileHover={{ scale: isWon ? 1 : 1.05 }} whileTap={{ scale: isWon ? 1 : 0.95 }} onClick={() => handleCardClick(card.id)} className={`flex aspect-square min-h-[5rem] items-center justify-center rounded-2xl border-4 p-2 text-center shadow-md transition-all ${card.isMatched ? 'border-green-200 bg-green-50' : isOpen ? 'border-indigo-100 bg-white' : 'border-indigo-700 bg-indigo-600'}`}>{isOpen ? <div className="flex min-w-0 flex-col items-center justify-center"><span className={`break-words font-bold leading-tight ${card.type === 'en' ? 'text-xs text-indigo-900 sm:text-base' : 'text-[11px] text-pink-600 sm:text-sm'}`}>{card.content}</span><div className="mt-1 text-[9px] font-bold uppercase text-gray-300">{card.type === 'en' ? 'Английский' : 'Русский'}</div></div> : <div className="text-3xl font-bold text-white" aria-hidden="true">?</div>}</motion.button>; })}</div><GameResultOverlay isOpen={isWon} status="won" title="Отлично!" subtitle={`Ты нашёл все пары за ${moves} ${moveWord(moves)}.`} emoji="🎉" pet={resultProgress?.pet} xpGained={showKidsRewards ? rewardPreview.xp : 0} coinsGained={showKidsRewards ? rewardPreview.coins : 0} scoreboard={<PersonalScoreboard gameId="memory" userKey={userProfile.username} value={moves} direction="lower" unit={moveWord(moves)} />} onPrimary={initializeGame} onSecondary={onBack} /></div>;
};
