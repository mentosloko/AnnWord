import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from '../services/shopCatalog';
import { applyPurchaseLocally, canPurchaseItem, getInventoryQuantity, getPurchaseErrorMessage } from '../services/economyEngine';
import { getShopImageUrl } from '../services/petAssets';
import { userService } from '../services/userService';

interface ShopProps {
  userProfile: UserProfile;
  onBuy?: (item: ShopItem) => Promise<void>;
  onClose: () => void;
}

type ShopTab = 'food' | 'accessory' | 'home' | 'mystery';

interface PurchaseCelebration {
  item: ShopItem;
  title: string;
  subtitle: string;
}

const getProfileSyncKey = (profile: UserProfile): string =>
  `${profile.username}|${profile.coins}|${profile.pet.level}|${profile.pet.type}|${JSON.stringify(profile.inventory)}`;

const getTabLabel = (tab: ShopTab): string => {
  if (tab === 'food') return 'Лакомства';
  if (tab === 'accessory') return 'Аксессуары';
  if (tab === 'mystery') return 'Секрет';
  return 'Домик';
};

const shouldCelebratePurchase = (item: ShopItem, awardedItem?: ShopItem): ShopItem | null => {
  if (awardedItem?.type === 'accessory') return awardedItem;
  if (item.type === 'accessory') return item;
  return null;
};

const PurchaseCelebrationModal: React.FC<{ celebration: PurchaseCelebration; onClose: () => void }> = ({ celebration, onClose }) => {
  const imageUrl = getShopImageUrl(celebration.item);

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
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="absolute top-3 h-2 w-2 rounded-full animate-[shopConfetti_1.4s_ease-out_infinite]"
              style={{
                left: `${8 + ((index * 17) % 84)}%`,
                animationDelay: `${index * 0.06}s`,
                backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899'][index % 4],
              }}
            />
          ))}
        </div>

        <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-[2rem] border-2 border-indigo-50 bg-white shadow-inner">
          {imageUrl ? (
            <img src={imageUrl} alt={celebration.item.name} className="h-24 w-24 object-contain" draggable={false} />
          ) : (
            <span className="text-6xl">🎁</span>
          )}
        </div>

        <h3 className="relative text-2xl font-black text-indigo-950">{celebration.title}</h3>
        <p className="relative mt-2 text-sm font-bold text-gray-500">{celebration.subtitle}</p>

        <button
          type="button"
          onClick={onClose}
          className="relative mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
        >
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
  const [activeTab, setActiveTab] = useState<ShopTab>('food');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<PurchaseCelebration | null>(null);
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

  const activeProfile = localProfile;
  const filteredItems = getShopItemsByType(activeTab)
    .filter(item => !item.characterType || item.characterType === activeProfile.pet.type);

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
    const celebratedItem = shouldCelebratePurchase(item, awardedItem);
    if (!celebratedItem) return;

    setCelebration({
      item: celebratedItem,
      title: awardedItem ? 'Аксессуар выпал!' : 'Аксессуар куплен!',
      subtitle: `${celebratedItem.name} добавлен в гардероб персонажа.`,
    });
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
    setBuyingId(item.id);

    try {
      const serverProfile = await syncPurchase(item);
      if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
      if (mountedRef.current) {
        setShopMessage(optimisticPurchase.awardedItem ? `Секретная коробка открыта: ${optimisticPurchase.awardedItem.name}!` : 'Покупка добавлена в инвентарь.');
        showPurchaseCelebration(item, optimisticPurchase.awardedItem);
      }
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('not a function') || message.includes('is not a function')) {
        try {
          const serverProfile = await userService.buyCurrentUserItem(item);
          if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
          if (mountedRef.current) {
            setShopMessage('Покупка добавлена в инвентарь.');
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
    <div className="flex flex-col p-3 sm:p-4 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button type="button" onClick={onClose} className="w-fit px-4 py-2 rounded-xl bg-white border-2 border-indigo-100 text-indigo-700 font-bold hover:bg-indigo-50 transition shadow-sm">← На главный экран</button>
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

      <div className="flex flex-wrap gap-2 mb-8 bg-indigo-50 p-1 rounded-2xl w-fit">
        {(['food', 'accessory', 'home', 'mystery'] as const).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setShopMessage(null); }} className={`px-4 sm:px-6 py-2 rounded-xl font-bold transition-all ${activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-indigo-600'}`}>
            {getTabLabel(tab)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          const isLocked = (activeProfile.pet.level || 1) < item.minLevel || Boolean(item.characterType && item.characterType !== activeProfile.pet.type);
          const canAfford = activeProfile.coins >= item.price;
          const ownedQuantity = getInventoryQuantity(activeProfile.inventory, item.id);
          const isOwnedOnce = ownedQuantity > 0 && item.type !== 'food' && item.type !== 'mystery';
          const isMystery = item.type === 'mystery';
          const imageUrl = getShopImageUrl(item);
          const canBuy = !isLocked && canAfford && !isOwnedOnce && buyingId !== item.id;

          return (
            <motion.div
              key={item.id}
              whileHover={canBuy ? { y: -5 } : {}}
              className={`relative rounded-3xl p-6 border-2 transition-all bg-white ${
                isOwnedOnce
                  ? 'border-green-200 shadow-sm ring-2 ring-green-50'
                  : isLocked
                    ? 'border-amber-100 shadow-sm'
                    : canAfford
                      ? 'border-indigo-50 shadow-sm hover:shadow-md'
                      : 'border-gray-100 opacity-70'
              }`}
            >
              {isOwnedOnce && (
                <div className="absolute right-4 top-4 z-10 rounded-full bg-green-500 px-3 py-1 text-xs font-black text-white shadow-sm">
                  Приобретено
                </div>
              )}

              <div className={`relative aspect-square mb-4 rounded-2xl overflow-hidden flex items-center justify-center border ${
                isMystery
                  ? 'bg-gradient-to-br from-purple-100 to-indigo-50 border-purple-100'
                  : item.type === 'accessory'
                    ? 'bg-white border-gray-100'
                    : 'bg-gradient-to-br from-white to-indigo-50 border-indigo-50'
              }`}>
                {isMystery ? (
                  <div className="text-7xl">🎁</div>
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className={`${item.type === 'accessory' ? 'h-[82%] w-[82%] object-contain' : 'w-full h-full object-cover'} ${isLocked ? 'opacity-70' : ''}`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <div className="text-6xl">🎁</div>
                )}
                {isLocked && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm text-white"><span className="text-3xl mb-1">🔒</span><span className="text-xs font-bold uppercase tracking-wider">Уровень {item.minLevel}</span></div>}
                {ownedQuantity > 0 && !isLocked && !isMystery && !isOwnedOnce && <div className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-indigo-700 shadow">x{ownedQuantity}</div>}
              </div>
              <h3 className="text-xl font-bold text-indigo-900 mb-1">{item.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-3">{item.description}</p>
              {isMystery && (
                <div className="mb-4 rounded-2xl bg-purple-50 border border-purple-100 px-3 py-2 text-xs font-bold text-purple-700">
                  Вероятности настраиваются в каталоге магазина через веса выпадения.
                </div>
              )}
              <div className="flex items-center justify-between mt-auto">
                <div className={`flex items-center gap-1 ${!canAfford ? 'text-gray-400' : isLocked ? 'text-amber-600' : isOwnedOnce ? 'text-green-600' : 'text-indigo-600'}`}><span className="font-bold">{item.price}</span><span className="text-sm">🪙</span></div>
                <button
                  disabled={!canBuy}
                  onClick={() => handleBuy(item)}
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    isOwnedOnce
                      ? 'bg-green-50 text-green-700 cursor-default border-2 border-green-100'
                      : isLocked
                        ? 'bg-amber-50 text-amber-600 cursor-not-allowed border-2 border-amber-100'
                        : !canAfford
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-100'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}
                >
                  {buyingId === item.id ? '...' : isOwnedOnce ? 'Куплено' : isLocked ? `Ур. ${item.minLevel}` : !canAfford ? 'Не хватает' : isMystery ? 'Открыть' : 'Купить'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
      <button onClick={onClose} className="mt-12 self-center px-5 py-3 rounded-2xl bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition">← На главный экран</button>

      {celebration && (
        <PurchaseCelebrationModal celebration={celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  );
};