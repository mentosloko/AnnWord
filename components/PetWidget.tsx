import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PetState } from '../types';
import { getPetEmoji, getPetNeedSnapshot } from '../services/petEngine';

interface PetWidgetProps {
  pet: PetState;
  onClick?: () => void;
  onNavigateToPetRoom?: () => void;
}

export const PetWidget: React.FC<PetWidgetProps> = ({ pet, onClick, onNavigateToPetRoom }) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const snapshot = getPetNeedSnapshot(pet);
  const emoji = snapshot.mood === 'sad' ? '😢' : getPetEmoji(pet);

  let color = 'bg-indigo-100 border-indigo-300';
  let message = 'Пойдём учить слова';

  if (snapshot.mood === 'sad') {
    color = 'bg-red-100 border-red-300';
    message = 'Я скучал!';
  } else if (snapshot.mood === 'calm') {
    color = 'bg-yellow-100 border-yellow-300';
    message = 'Готов к игре';
  } else if (snapshot.mood === 'joyful' || snapshot.mood === 'super_happy') {
    color = 'bg-purple-100 border-purple-300';
    message = 'Супернастроение!';
  } else {
    color = 'bg-green-100 border-green-300';
    message = 'Рад учиться';
  }

  const handleClick = () => {
    setFeedback('Открываю комнату...');
    window.setTimeout(() => setFeedback(null), 1400);
    onNavigateToPetRoom?.();
    onClick?.();
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-col items-end gap-2 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white px-3 py-1.5 rounded-xl rounded-tr-none shadow-md text-xs font-bold text-gray-600 border border-gray-100"
      >
        {feedback || message}
      </motion.div>
      
      <button 
        type="button"
        onClick={handleClick}
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 ${color} shadow-lg flex flex-col items-center justify-center relative bg-white transition-transform hover:scale-105 active:scale-95 cursor-pointer`}
        aria-label="Открыть комнату персонажа"
        title="Открыть комнату персонажа"
      >
        <span className="text-3xl sm:text-4xl leading-none select-none filter drop-shadow-sm">{emoji}</span>
        <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] sm:text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
          {pet.level}
        </div>
        <div className="absolute -left-3 top-2 bottom-2 w-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
          <div 
            className={`w-full absolute bottom-0 transition-all ${snapshot.moodScore <= 20 ? 'bg-red-500' : snapshot.moodScore <= 45 ? 'bg-yellow-500' : snapshot.moodScore <= 70 ? 'bg-green-500' : 'bg-indigo-500'}`}
            style={{ height: `${snapshot.moodScore}%` }}
          />
        </div>
        <div className="absolute -top-2 -right-2 bg-white text-indigo-600 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-indigo-100 shadow-sm">
          ↗
        </div>
      </button>
    </div>
  );
};