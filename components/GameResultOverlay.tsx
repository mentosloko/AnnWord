import React from 'react';
import { motion } from 'motion/react';
import { PetState } from '../types';
import { CharacterProgressCard } from './CharacterProgressCard';
import { normalizeMoodScore } from '../services/gamificationRules';

interface GameResultOverlayProps {
  isOpen: boolean;
  status: 'won' | 'lost' | 'completed';
  title: string;
  subtitle?: string;
  emoji?: string;
  pet: PetState;
  xpGained: number;
  coinsGained: number;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  details?: React.ReactNode;
}
const getStatusTone = (status: GameResultOverlayProps['status']) => status === 'won' ? 'from-green-50 via-white to-indigo-50 border-green-100 text-green-700' : status === 'lost' ? 'from-rose-50 via-white to-indigo-50 border-rose-100 text-rose-700' : 'from-indigo-50 via-white to-purple-50 border-indigo-100 text-indigo-700';
const getFeedingPrompt = (pet: PetState, coinsGained: number): string | null => {
  if (coinsGained <= 0) return null;
  const moodScore = normalizeMoodScore(pet);
  if (moodScore <= 45) return `${pet.name} проголодался. На заработанные монеты можно купить лакомство и покормить питомца.`;
  if (moodScore <= 70) return `${pet.name} будет рад лакомству после игры. Загляните в магазин за угощением.`;
  return 'Монеты начислены. Можно накопить на новые лакомства или аксессуары.';
};
export const GameResultOverlay: React.FC<GameResultOverlayProps> = ({ isOpen, status, title, subtitle, emoji = status === 'lost' ? '💪' : '🎉', pet, xpGained, coinsGained, primaryLabel = 'Играть снова', secondaryLabel = 'В меню', onPrimary, onSecondary, details }) => {
  if (!isOpen) return null;
  const feedingPrompt = getFeedingPrompt(pet, coinsGained);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-indigo-950/45 px-3 py-4 backdrop-blur-sm sm:px-4"><motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`max-h-[92vh] w-full max-w-[min(32rem,94vw)] overflow-y-auto rounded-[2rem] border-2 bg-gradient-to-br p-4 text-center shadow-2xl sm:p-6 ${getStatusTone(status)}`}><div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm sm:h-20 sm:w-20 sm:text-5xl">{emoji}</div><h2 className="text-2xl font-black text-indigo-950 sm:text-3xl">{title}</h2>{subtitle && <p className="mx-auto mt-2 max-w-sm text-sm font-bold text-gray-500 sm:text-base">{subtitle}</p>}{details && <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/70 p-3 text-sm font-bold text-indigo-900">{details}</div>}{feedingPrompt && <div className="mt-4 rounded-2xl border-2 border-amber-100 bg-amber-50 p-3 text-sm font-black text-amber-800">🍪 {feedingPrompt}</div>}<div className="mt-5"><CharacterProgressCard pet={pet} xpGained={xpGained} coinsGained={coinsGained}/></div><div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"><button type="button" onClick={onPrimary} className="rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white shadow-lg shadow-indigo-100">{primaryLabel}</button>{onSecondary && <button type="button" onClick={onSecondary} className="rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3 font-black text-indigo-700">{secondaryLabel}</button>}</div></motion.div></div>;
};