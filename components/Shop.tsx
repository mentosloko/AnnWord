import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from '../services/shopCatalog';
import { applyPurchaseLocally, canPurchaseItem, getInventoryQuantity, getPurchaseErrorMessage } from '../services/economyEngine';
import { userService } from '../services/userService';

interface ShopProps {
  userProfile: UserProfile;
  onBuy?: (item: ShopItem) => Promise<void>;
  onClose: () => void;
}

const getProfileSyncKey = (profile: UserProfile): string =>
  `${profile.username}|${profile.coins}|${profile.pet.level}|${JSON.stringify(profile.inventory)}`;

export const Shop: React.FC<ShopProps> = ({ userProfile, onBuy, onClose }) => {
  const [activeTab, setActiveTab] = useState<'food' | 'pet' | 'accessory'>('food');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [localProfile, setLocalProfile] = useState<UserProfile>(userProfile);
  const lastExternalProfileKey = useRef(getProfileSyncKey(userProfile));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextExternalKey = getProfileSyncKey(userProfile);
    if (nextExternalKey !== lastExternalProfileKey.current) {
      lastExternalProfileKey.current = nextExternalKey;
      setLocalProfile(userProfile);
    }
  }, [userProfile]);

  const filteredItems = getShopItemsByType(activeTab);
  const activeProfile = localProfile;

  const setLocalAndRemember = (profile: UserProfile) => {
    setLocalProfile(profile);
    lastExternalProfileKey.current = getProfileSyncKey(profile);
  };

  const syncPurchase = async (item: ShopItem): Promise<UserProfile | null> => {
    if (typeof onBuy === 'function') {
      await onBuy(item);
      return null;
    }
    return userService.buyCurrentUserItem(item);
  };

  const handleBuy = async (item: ShopItem) => {
    if (buyingId) return;
    const purchaseCheck = canPurchaseItem(activeProfile, item);
    if (!purchaseCheck.ok) {
      setShopMessage(getPurchaseErrorMessage(purchaseCheck.reason));
      return;
    }

    const optimisticPurchase = applyPurchaseLocally(activeProfile, item);
    if (!optimisticPurchase.ok || !optimisticPurchase.profile) {
      setShopMessage(getPurchaseErrorMessage(optimisticPurchase.reason));
      return;
    }

    setLocalAndRemember(optimisticPurchase.profile);
    setShopMessage(null);
    setBuyingId(item.id);

    try {
      const serverProfile = await syncPurchase(item);
      if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
      if (mountedRef.current) setShopMessage('Покупка добавлена в инвентарь.');
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('not a function') || message.includes('is not a function')) {
        try {
          const serverProfile = await userService.buyCurrentUserItem(item);
          if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
          if (mountedRef.current) setShopMessage('Покупка добавлена в инвентарь.');
        } catch (fallbackError: any) {
          if (mountedRef.current) {
            setLocalAndRemember(userProfile);
            setShopMessage(fallbackError?.message || 'Покупка не удалась.');
          }
        }
      } else if (mountedRef.current) {
        setLocalAndRemember(userProfile);
        setShopMessage(message || 'Покупка не удалась.');
      }
    } finally {
      if (mountedRef.current) setBuyingId(null);
    }
  };

  return (
    <div className="flex flex-col p-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white border-2 border-indigo-100 text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-sm">← На главный экран</button>
          <h2 className="text-3xl font-bold text-indigo-900">Магазин</h2>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-2xl border-2 border-yellow-200 w-fit">
          <span className="text-xl font-bold text-yellow-700">{activeProfile.coins}</span><span className="text-lg">🪙</span>
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
          const isLocked = (activeProfile.pet.level || 1) < item.minLevel;
          const canAfford = activeProfile.coins >= item.price;
          const ownedQuantity = getInventoryQuantity(activeProfile.inventory, item.id);
          return (
            <motion.div key={item.id} whileHover={canAfford && !isLocked ? { y: -5 } : {}} className={`bg-white rounded-3xl p-6 border-2 transition-all ${isLocked ? 'border-amber-100 shadow-sm' : canAfford ? 'border-indigo-50 shadow-sm hover:shadow-md' : 'border-gray-100 opacity-70'}`}>
              <div className="relative aspect-square mb-4 bg-indigo-50 rounded-2xl overflow-hidden">
                <img src={item.imageUrl} alt={item.name} className={`w-full h-full object-cover ${isLocked ? 'opacity-70' : ''}`} referrerPolicy="no-referrer" />
                {isLocked && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm text-white"><span className="text-3xl mb-1">🔒</span><span className="text-xs font-bold uppercase tracking-wider">Уровень {item.minLevel}</span></div>}
                {ownedQuantity > 0 && !isLocked && <div className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-indigo-700 shadow">x{ownedQuantity}</div>}
              </div>
              <h3 className="text-xl font-bold text-indigo-900 mb-1">{item.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <div className={`flex items-center gap-1 ${!canAfford ? 'text-gray-400' : isLocked ? 'text-amber-600' : 'text-indigo-600'}`}><span className="font-bold">{item.price}</span><span className="text-sm">🪙</span></div>
                <button disabled={isLocked || !canAfford || buyingId === item.id} onClick={() => handleBuy(item)} className={`px-4 py-2 rounded-xl font-bold transition-all ${isLocked ? 'bg-amber-50 text-amber-600 cursor-not-allowed border-2 border-amber-100' : !canAfford ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}>{buyingId === item.id ? '...' : isLocked ? `Ур. ${item.minLevel}` : !canAfford ? 'Не хватает' : 'Купить'}</button>
              </div>
            </motion.div>
          );
        })}
      </div>
      <button onClick={onClose} className="mt-12 self-center px-5 py-3 rounded-2xl bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition">← На главный экран</button>
    </div>
  );
};