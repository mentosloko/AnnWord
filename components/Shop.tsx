import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from '../services/shopCatalog';
import { canPurchaseItem, getInventoryQuantity, getPurchaseErrorMessage } from '../services/economyEngine';
import { forceHomeNavigation } from '../utils/navigationBridge';

interface ShopProps {
  userProfile: UserProfile;
  onBuy: (item: ShopItem) => Promise<void>;
  onClose: () => void;
}

export const Shop: React.FC<ShopProps> = ({ userProfile, onBuy, onClose }) => {
  const [activeTab, setActiveTab] = useState<'food' | 'pet' | 'accessory'>('food');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const filteredItems = getShopItemsByType(activeTab);

  const handleBuy = async (item: ShopItem) => {
    if (buyingId) return;
    const purchaseCheck = canPurchaseItem(userProfile, item);
    if (!purchaseCheck.ok) {
      setShopMessage(getPurchaseErrorMessage(purchaseCheck.reason));
      return;
    }

    setShopMessage(null);
    setBuyingId(item.id);
    try {
      await onBuy(item);
      if (mountedRef.current) setShopMessage('Покупка добавлена в инвентарь.');
    } catch (error: any) {
      if (mountedRef.current) setShopMessage(error?.message || 'Покупка не удалась.');
    } finally {
      if (mountedRef.current) setBuyingId(null);
    }
  };

  const handleClose = () => {
    try {
      onClose();
    } finally {
      forceHomeNavigation();
    }
  };

  return (
    <div className="flex flex-col p-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-xl bg-white border-2 border-indigo-100 text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-sm">← На главный экран</button>
          <h2 className="text-3xl font-bold text-indigo-900">Магазин</h2>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-2xl border-2 border-yellow-200 w-fit">
          <span className="text-xl font-bold text-yellow-700">{userProfile.coins}</span><span className="text-lg">🪙</span>
        </div>
      </div>

      {shopMessage && (
        <div className="mb-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
          {shopMessage}
        </div>
      )}

      <div className="flex gap-2 mb-8 bg-indigo-50 p-1 rounded-2xl w-fit">
        {(['food', 'pet', 'accessory'] as const).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setShopMessage(null); }} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-indigo-600'}`}>
            {tab === 'food' ? 'Еда' : tab === 'pet' ? 'Питомцы' : 'Аксессуары'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          const isLocked = (userProfile.pet.level || 1) < item.minLevel;
          const canAfford = userProfile.coins >= item.price;
          const ownedQuantity = getInventoryQuantity(userProfile.inventory, item.id);
          return (
            <motion.div key={item.id} whileHover={!isLocked ? { y: -5 } : {}} className={`bg-white rounded-3xl p-6 border-2 transition-all ${isLocked ? 'opacity-60 border-gray-100 grayscale' : 'border-indigo-50 shadow-sm hover:shadow-md'}`}>
              <div className="relative aspect-square mb-4 bg-indigo-50 rounded-2xl overflow-hidden">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                {isLocked && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm text-white"><span className="text-3xl mb-1">🔒</span><span className="text-xs font-bold uppercase tracking-wider">Уровень {item.minLevel}</span></div>}
                {ownedQuantity > 0 && !isLocked && <div className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-indigo-700 shadow">x{ownedQuantity}</div>}
              </div>
              <h3 className="text-xl font-bold text-indigo-900 mb-1">{item.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <div className={`flex items-center gap-1 ${isLocked ? 'text-gray-400' : 'text-indigo-600'}`}><span className="font-bold">{item.price}</span><span className="text-sm">🪙</span></div>
                <button disabled={isLocked || !canAfford || buyingId === item.id} onClick={() => handleBuy(item)} className={`px-4 py-2 rounded-xl font-bold transition-all ${isLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : !canAfford ? 'bg-red-50 text-red-300 cursor-not-allowed border-2 border-red-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}>{buyingId === item.id ? '...' : isLocked ? '🔒' : !canAfford ? '🪙' : 'Купить'}</button>
              </div>
            </motion.div>
          );
        })}
      </div>
      <button onClick={handleClose} className="mt-12 self-center px-5 py-3 rounded-2xl bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition">← На главный экран</button>
    </div>
  );
};
