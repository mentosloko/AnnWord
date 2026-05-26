import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from '../services/shopCatalog';
import { applyPurchaseLocally, canPurchaseItem, getInventoryQuantity, getPurchaseErrorMessage } from '../services/economyEngine';
import { getShopImageUrl } from '../services/petAssets';
import { getInventoryEmoji } from '../services/petEngine';
import { userService } from '../services/userService';
import { CoinIcon } from './CoinIcon';

interface ShopProps {
  userProfile: UserProfile;
  onBuy?: (item: ShopItem) => Promise<void>;
  onClose: () => void;
}

type ShopTab = 'food' | 'accessory' | 'home' | 'mystery';
type VisibleShopTab = Exclude<ShopTab, 'home'>;

const VISIBLE_SHOP_TABS: VisibleShopTab[] = ['food', 'accessory', 'mystery'];

interface PurchaseCelebration {
  item: ShopItem;
  title: string;
  subtitle: string;
  source: 'purchase' | 'mystery';
}

const getProfileSyncKey = (profile: UserProfile): string =>
  `${profile.username}|${profile.coins}|${profile.pet.level}|${profile.pet.type}|${JSON.stringify(profile.inventory)}`;

const getTabLabel = (tab: ShopTab): string => {
  if (tab === 'food') return 'Лакомства';
  if (tab === 'accessory') return 'Аксессуары';
  if (tab === 'mystery') return 'Секрет';
  return 'Домик';
};

const getRewardDestinationText = (item: ShopItem): string => {
  if (item.type === 'food') return 'добавлено в лакомства';
  if (item.type === 'accessory') return 'добавлен в гардероб персонажа';
  if (item.type === 'home') return 'добавлено в комнату персонажа';
  return 'добавлено к предметам';
};

const shouldCelebratePurchase = (item: ShopItem, awardedItem?: ShopItem): PurchaseCelebration | null => {
  if (awardedItem) {
    return {
      item: awardedItem,
      source: 'mystery',
      title: 'Секретная коробка открыта!',
      subtitle: `Выпало: ${awardedItem.name} — ${getRewardDestinationText(awardedItem)}.`,
    };
  }

  if (item.type === 'accessory') {
    return {
      item,
      source: 'purchase',
      title: 'Аксессуар куплен!',
      subtitle: `${item.name} добавлен в гардероб персонажа.`,
    };
  }

  return null;
};

const PurchaseCelebrationModal: React.FC<{ celebration: PurchaseCelebration; onClose: () => void }> = ({ celebration, onClose }) => {
  const imageUrl = getShopImageUrl(celebration.item);
  const isMystery = celebration.source === 'mystery';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-indigo-950/45 px-4 backdrop-blur-sm">
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-indigo-100 bg-white p-6 text-center shadow-2xl"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: isMystery ? 28 : 18 }).map((_, index) => (
            <span
              key={index}
              className="absolute top-3 h-2 w-2 rounded-full animate-[shopConfetti_1.4s_ease-out_infinite]"
              style={{
                left: `${8 + ((index * 17) % 84)}%`,
                animationDelay: `${index * 0.045}s`,
                backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899'][index % 4],
              }}
            />
          ))}
        </div>

        {isMystery && (
          <div className="relative mx-auto mb-2 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-1 text-xs font-black uppercase tracking-widest text-purple-700 border border-purple-100">
            🎁 Выпавший предмет
          </div>
        )}

        <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-[2rem] border-2 border-indigo-50 bg-white shadow-inner">
          {imageUrl ? <img src={imageUrl} alt={celebration.item.name} className="h-24 w-24 object-contain" draggable={false} /> : <span className="text-6xl">{getInventoryEmoji({ id: celebration.item.id, name: celebration.item.name, type: celebration.item.type, quantity: 1 })}</span>}
        </div>

        <h3 className="relative text-2xl font-black text-indigo-950">{celebration.title}</h3>
        <p className="relative mt-2 text-sm font-bold text-gray-500">{celebration.subtitle}</p>

        <button type="button" onClick={onClose} className="relative mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700">
          Отлично
        </button>
      </motion.div>

      <style>{`
        @keyframes shopConfetti {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(330px) rotate(520deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export const Shop: React.FC<ShopProps> = ({ userProfile, onBuy, onClose }) => {
  const [activeTab, setActiveTab] = useState<VisibleShopTab>('food');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [pulseItemId, setPulseItemId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<PurchaseCelebration | null>(null);
  const [localProfile, setLocalProfile] = useState<UserProfile>(userProfile);
  const lastExternalProfileKey = useRef(getProfileSyncKey(userProfile));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const nextExternalKey = getProfileSyncKey(userProfile);
    if (nextExternalKey !== lastExternalProfileKey.current) {
      lastExternalProfileKey.current = nextExternalKey;
      setLocalProfile(userProfile);
    }
  }, [userProfile]);

  const activeProfile = localProfile;
  const filteredItems = getShopItemsByType(activeTab).filter(item => !item.characterType || item.characterType === activeProfile.pet.type);

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

  const showPurchaseCelebration = (item: ShopItem, awardedItem?: ShopItem) => {
    const nextCelebration = shouldCelebratePurchase(item, awardedItem);
    if (!nextCelebration) return;
    setCelebration(nextCelebration);
  };

  const showQuantityPulse = (itemId: string) => {
    setPulseItemId(itemId);
    window.setTimeout(() => {
      if (mountedRef.current) setPulseItemId(null);
    }, 900);
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
    setShopMessage(optimisticPurchase.awardedItem ? `Секретная коробка открыта: ${optimisticPurchase.awardedItem.name}!` : null);
    showQuantityPulse(optimisticPurchase.awardedItem?.id || item.id);
    setBuyingId(item.id);

    try {
      const serverProfile = await syncPurchase(item);
      if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
      if (mountedRef.current) {
        setShopMessage(optimisticPurchase.awardedItem ? `Секретная коробка открыта: ${optimisticPurchase.awardedItem.name}!` : null);
        showQuantityPulse(optimisticPurchase.awardedItem?.id || item.id);
        showPurchaseCelebration(item, optimisticPurchase.awardedItem);
      }
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('not a function') || message.includes('is not a function')) {
        try {
          const serverProfile = await userService.buyCurrentUserItem(item);
          if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
          if (mountedRef.current) {
            setShopMessage(null);
            showQuantityPulse(optimisticPurchase.awardedItem?.id || item.id);
            showPurchaseCelebration(item, optimisticPurchase.awardedItem);
          }
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
    <div className="mx-auto flex max-w-5xl flex-col p-3 pb-24 sm:p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onClose} aria-label="На главный экран" title="Назад" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50">
          ←
        </button>
        <h2 className="min-w-0 flex-1 text-center text-3xl font-black text-indigo-900">Магазин</h2>
        <div className="flex h-11 shrink-0 items-center gap-2 rounded-2xl border-2 border-yellow-200 bg-yellow-50 px-3">
          <span className="text-lg font-black text-yellow-700">{activeProfile.coins}</span><CoinIcon />
        </div>
      </div>

      {shopMessage && <div className="mb-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">{shopMessage}</div>}

      <div className="mb-6 flex w-fit flex-wrap gap-2 rounded-2xl bg-indigo-50 p-1">
        {VISIBLE_SHOP_TABS.map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setShopMessage(null); }} className={`rounded-xl px-4 py-2 font-bold transition-all sm:px-6 ${activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-indigo-600'}`}>
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map(item => {
          const isLocked = (activeProfile.pet.level || 1) < item.minLevel || Boolean(item.characterType && item.characterType !== activeProfile.pet.type);
          const canAfford = activeProfile.coins >= item.price;
          const ownedQuantity = getInventoryQuantity(activeProfile.inventory, item.id);
          const isOwnedOnce = ownedQuantity > 0 && item.type !== 'food' && item.type !== 'mystery';
          const isMystery = item.type === 'mystery';
          const imageUrl = getShopImageUrl(item);
          const canBuy = !isLocked && canAfford && !isOwnedOnce && buyingId !== item.id;
          const shouldPulse = pulseItemId === item.id;

          return (
            <motion.div key={item.id} whileHover={{ y: isLocked ? 0 : -4 }} className={`relative rounded-3xl border-2 bg-white p-5 shadow-sm transition ${isLocked ? 'border-gray-100 opacity-70' : 'border-indigo-50 hover:border-indigo-200'}`}>
              {isLocked && <div className="absolute top-4 right-4 bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full font-bold">Ур. {item.minLevel}</div>}
              {isOwnedOnce && !isLocked && <div className="absolute top-4 right-4 bg-green-50 text-green-700 text-xs px-3 py-1 rounded-full font-bold border border-green-100">Есть</div>}
              {ownedQuantity > 0 && item.type === 'food' && (
                <div className={`absolute right-4 top-4 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-pink-500 px-2 text-sm font-black text-white shadow-lg transition ${shouldPulse ? 'scale-125 animate-bounce' : ''}`}>×{ownedQuantity}</div>
              )}
              {isMystery && !isLocked && <div className="absolute top-4 right-4 bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full font-black border border-purple-100">?</div>}
              <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt={item.name} className="w-full h-full object-contain" draggable={false} /> : <span className="text-5xl">🎁</span>}
              </div>
              <h3 className="text-xl font-bold text-indigo-900 text-center mb-2">{item.name}</h3>
              <p className="text-sm text-gray-500 text-center min-h-[48px]">{item.description}</p>
              <div className="flex items-center justify-center gap-2 mt-4 mb-4 text-yellow-700 font-bold">
                <span>{item.price}</span><CoinIcon />
              </div>
              <button type="button" disabled={!canBuy} onClick={() => handleBuy(item)} className={`w-full py-3 rounded-2xl font-bold transition ${canBuy ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                {buyingId === item.id ? 'Покупаю...' : isOwnedOnce ? 'Уже есть' : !canAfford ? 'Не хватает монет' : isMystery ? 'Открыть' : 'Купить'}
              </button>
            </motion.div>
          );
        })}
      </div>

      {celebration && <PurchaseCelebrationModal celebration={celebration} onClose={() => setCelebration(null)} />}
    </div>
  );
};