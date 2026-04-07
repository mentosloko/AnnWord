import React from 'react';
import { motion } from 'motion/react';
import { PetState } from '../types';

interface PetWidgetProps {
  pet: PetState;
  onClick: () => void;
}

export const PetWidget: React.FC<PetWidgetProps> = ({ pet, onClick }) => {
  // Simple visual representation using emoji/svg based on mood
  let emoji = '🦉';
  if (pet.type === 'Cat') emoji = '🐱';
  else if (pet.type === 'Dragon') emoji = '🐲';
  
  let color = 'bg-gray-200';
  let message = '';

  const hunger = pet.hunger ?? 100;
  const energy = pet.energy ?? 100;

  if (hunger < 30) {
    emoji = '😿';
    color = 'bg-red-100 border-red-300';
    message = 'Я голоден!';
  } else if (pet.mood === 'happy') {
    color = 'bg-green-100 border-green-300';
    message = 'Вкусно! Еще!';
  } else {
    color = 'bg-indigo-100 border-indigo-300';
    message = 'Покорми меня словами';
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-col items-end gap-2 z-50">
      {/* Speech Bubble */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white px-3 py-1.5 rounded-xl rounded-tr-none shadow-md text-xs font-bold text-gray-600 border border-gray-100"
      >
        {message}
      </motion.div>
      
      {/* Avatar Container */}
      <button 
        onClick={onClick}
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 ${color} shadow-lg flex flex-col items-center justify-center relative bg-white transition-transform hover:scale-105 active:scale-95`}
      >
        <span className="text-3xl sm:text-4xl leading-none select-none filter drop-shadow-sm">{emoji}</span>
        
        {/* Level Badge */}
        <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] sm:text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
          {pet.level}
        </div>

        {/* Hunger Bar (Vertical) */}
        <div className="absolute -left-3 top-2 bottom-2 w-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
          <div 
            className={`w-full absolute bottom-0 transition-all ${hunger < 30 ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ height: `${hunger}%` }}
          />
        </div>
      </button>
    </div>
  );
};
