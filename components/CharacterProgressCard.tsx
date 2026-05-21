import React from 'react';
import { PetState } from '../types';
import { CHARACTER_LEVEL_THRESHOLDS, getCharacterStageLabel, getCurrentLevelThreshold, getNextLevelThreshold } from '../services/gamificationRules';
import { getPetEmoji } from '../services/petEngine';

interface CharacterProgressCardProps {
  pet: PetState;
  xpGained: number;
  coinsGained: number;
  title?: string;
}

export const CharacterProgressCard: React.FC<CharacterProgressCardProps> = ({
  pet,
  xpGained,
  coinsGained,
  title = 'Прогресс персонажа',
}) => {
  const currentLevelXp = getCurrentLevelThreshold(pet.level || 1);
  const nextLevelXp = getNextLevelThreshold(pet.level || 1);
  const isMaxLevel = nextLevelXp === null;
  const progressPercent = isMaxLevel
    ? 100
    : Math.max(0, Math.min(100, (((pet.xp || 0) - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
  const maxLevel = CHARACTER_LEVEL_THRESHOLDS[CHARACTER_LEVEL_THRESHOLDS.length - 1].level;
  const coinDeltaLabel = coinsGained > 0 ? `+${coinsGained}` : String(coinsGained);

  return (
    <div className="rounded-[2rem] bg-indigo-50 border-2 border-indigo-100 p-5 text-left w-full">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-sm">
          {getPetEmoji(pet)}
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-indigo-400">{title}</div>
          <div className="text-xl font-black text-indigo-950">{pet.name}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl bg-white p-3 border border-indigo-100">
          <div className="text-xs font-black uppercase tracking-widest text-indigo-300">XP</div>
          <div className="text-2xl font-black text-indigo-700">+{xpGained}</div>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-yellow-100">
          <div className="text-xs font-black uppercase tracking-widest text-yellow-400">Монеты</div>
          <div className="text-2xl font-black text-yellow-600">{coinDeltaLabel} 🪙</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-black text-indigo-900">Уровень {pet.level}</div>
        <div className="text-xs font-bold text-indigo-400">{isMaxLevel ? `Макс. уровень ${maxLevel}` : `${pet.xp}/${nextLevelXp} XP`}</div>
      </div>
      <div className="h-3 rounded-full bg-white overflow-hidden border border-indigo-100">
        <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-2 text-xs font-bold text-indigo-400">Стадия: {getCharacterStageLabel(pet.stage)}</div>
    </div>
  );
};