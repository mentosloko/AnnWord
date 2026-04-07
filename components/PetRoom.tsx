import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, InventoryItem } from '../types';

interface PetRoomProps {
  userProfile: UserProfile;
  onUseItem: (itemId: string) => Promise<void>;
  onClose: () => void;
}

export const PetRoom: React.FC<PetRoomProps> = ({ userProfile, onUseItem, onClose }) => {
  const [activeTab, setActiveTab] = useState<'food' | 'accessory' | 'pet'>('food');
  const [usingId, setUsingId] = useState<string | null>(null);

  const inventory = userProfile.inventory || [];
  const filteredInventory = inventory.filter(item => item.type === activeTab);

  const handleUse = async (itemId: string) => {
    setUsingId(itemId);
    try {
      await onUseItem(itemId);
    } finally {
      setUsingId(null);
    }
  };

  const pet = userProfile.pet;

  return (
    <div className="flex flex-col p-4 max-w-4xl mx-auto">
      <div className="w-full flex justify-between items-center mb-8">
        <button 
          onClick={onClose} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Комната питомца</div>
        <div className="w-16"></div>
      </div>

      <div className="flex justify-between items-center mb-12">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold text-indigo-900">Твой питомец</h2>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-3xl shadow-sm border-2 border-indigo-50">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Голод</span>
            <div className="w-24 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pet.hunger || 0}%` }}
                className={`h-full transition-all ${
                  (pet.hunger || 0) < 30 ? 'bg-red-500' : (pet.hunger || 0) < 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Энергия</span>
            <div className="w-24 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pet.energy || 0}%` }}
                className="h-full bg-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Pet Display */}
        <div className="relative aspect-square bg-gradient-to-br from-indigo-50 to-white rounded-[4rem] flex items-center justify-center border-4 border-white shadow-xl">
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              scale: [1, 1.02, 1]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 3,
              ease: "easeInOut"
            }}
            className="relative"
          >
            <div className="text-9xl">
              {pet.type === 'Owl' ? '🦉' : pet.type === 'Cat' ? '🐱' : pet.type === 'Dragon' ? '🐲' : '🐾'}
            </div>
            
            {/* Accessories Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {pet.equippedAccessories?.includes('hat') && (
                <div className="absolute -top-10 text-5xl">🎩</div>
              )}
              {pet.equippedAccessories?.includes('glasses') && (
                <div className="absolute top-4 text-4xl">🕶️</div>
              )}
            </div>
          </motion.div>

          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white px-8 py-2 rounded-2xl shadow-lg border-2 border-indigo-50">
            <h3 className="text-2xl font-black text-indigo-900">{pet.name}</h3>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest text-center">Уровень {pet.level}</p>
          </div>
        </div>

        {/* Inventory */}
        <div className="flex flex-col bg-white rounded-[3rem] p-8 border-2 border-indigo-50 shadow-sm min-h-[400px]">
          <div className="flex gap-2 mb-8 bg-indigo-50 p-1 rounded-2xl w-fit">
            {(['food', 'accessory', 'pet'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-xl font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-white text-indigo-900 shadow-sm' 
                    : 'text-indigo-400 hover:text-indigo-600'
                }`}
              >
                {tab === 'food' ? 'Еда' : tab === 'accessory' ? 'Гардероб' : 'Питомцы'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {filteredInventory.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-12 text-gray-400">
                <span className="text-4xl mb-2">📦</span>
                <p className="text-sm font-medium">Пусто</p>
              </div>
            ) : (
              filteredInventory.map(item => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleUse(item.id)}
                  className={`aspect-square rounded-3xl p-2 cursor-pointer border-2 transition-all flex flex-col items-center justify-center relative ${
                    pet.equippedAccessories?.includes(item.id) || pet.type === item.name
                      ? 'bg-indigo-600 border-indigo-700 text-white' 
                      : 'bg-indigo-50 border-indigo-100 text-indigo-900 hover:bg-indigo-100'
                  }`}
                >
                  <div className="text-3xl mb-1">
                    {item.id === 'apple' ? '🍎' : item.id === 'cake' ? '🍰' : item.id === 'steak' ? '🥩' : 
                     item.id === 'hat' ? '🎩' : item.id === 'glasses' ? '🕶️' : 
                     item.id === 'cat' ? '🐱' : item.id === 'dragon' ? '🐲' : '🎁'}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-center line-clamp-1">{item.name}</span>
                  {item.quantity > 1 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {item.quantity}
                    </div>
                  )}
                  {usingId === item.id && (
                    <div className="absolute inset-0 bg-white/50 rounded-3xl flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          <div className="mt-auto pt-8 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 font-medium">
              {activeTab === 'food' ? 'Нажми, чтобы покормить' : 
               activeTab === 'accessory' ? 'Нажми, чтобы надеть/снять' : 
               'Нажми, чтобы сменить питомца'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
