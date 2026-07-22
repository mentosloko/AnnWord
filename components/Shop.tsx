import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from '../services/shopCatalog';
import { applyPurchaseLocally, canPurchaseItem, getInventoryQuantity } from '../services/economyEngine';
import { getShopImageUrl } from '../services/petAssets';
import { getInventoryEmoji } from '../services/petEngine';
import { userService } from '../services/userService';
import { CoinIcon } from './CoinIcon';

interface ShopProps { userProfile: UserProfile; onBuy?: (item: ShopItem) => Promise<void>; onClose: () => void; onOpenPetRoom?: () => void; }
type VisibleShopTab = 'food' | 'accessory';
const VISIBLE_SHOP_TABS: VisibleShopTab[] = ['food', 'accessory'];
interface PurchaseCelebration { item: ShopItem; title: string; subtitle: string; source: 'purchase' | 'mystery'; }
const getProfileSyncKey = (profile: UserProfile) => `${profile.username}|${profile.coins}|${profile.pet.level}|${profile.pet.type}|${JSON.stringify(profile.inventory)}`;
const getTabLabel = (tab: VisibleShopTab) => tab === 'food' ? 'Лакомства' : 'Аксессуары';
const getItemBenefitText = (item: ShopItem) => item.type === 'food' ? `+${item.effect?.mood || 0} к настроению` : item.type === 'accessory' ? 'Можно надеть в комнате' : 'Внутри случайный предмет';
const getRewardDestinationText = (item: ShopItem) => item.type === 'food' ? 'добавлено в лакомства' : item.type === 'accessory' ? 'добавлен в гардероб персонажа' : 'добавлено к предметам';
const shouldCelebratePurchase = (item: ShopItem, awardedItem?: ShopItem): PurchaseCelebration | null => awardedItem ? { item: awardedItem, source: 'mystery', title: 'Секретная коробка открыта!', subtitle: `Выпало: ${awardedItem.name} — ${getRewardDestinationText(awardedItem)}.` } : item.type === 'accessory' ? { item, source: 'purchase', title: 'Аксессуар куплен!', subtitle: `${item.name} добавлен в гардероб персонажа.` } : item.type === 'food' ? { item, source: 'purchase', title: 'Лакомство куплено!', subtitle: `${item.name} добавлено в лакомства питомца.` } : null;

const PurchaseCelebrationModal: React.FC<{ celebration: PurchaseCelebration; onClose: () => void; onOpenPetRoom?: () => void }> = ({ celebration, onClose, onOpenPetRoom }) => {
  const imageUrl = getShopImageUrl(celebration.item);
  const isMystery = celebration.source === 'mystery';
  const goPetRoom = () => { onClose(); onOpenPetRoom?.(); };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-indigo-950/45 px-4 backdrop-blur-sm" role="presentation"><motion.div role="dialog" aria-modal="true" aria-labelledby="purchase-title" aria-describedby="purchase-description" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-indigo-100 bg-white p-6 text-center shadow-2xl">{isMystery && <div className="mx-auto mb-2 inline-flex rounded-full border border-purple-100 bg-purple-50 px-4 py-1 text-xs font-black uppercase text-purple-700">🎁 Выпавший предмет</div>}<div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-[2rem] border-2 border-indigo-50 bg-white shadow-inner">{imageUrl ? <img src={imageUrl} alt={celebration.item.name} className="h-24 w-24 object-contain" /> : <span className="text-6xl">{getInventoryEmoji({ id: celebration.item.id, name: celebration.item.name, type: celebration.item.type, quantity: 1 })}</span>}</div><h3 id="purchase-title" className="text-2xl font-black text-indigo-950">{celebration.title}</h3><p id="purchase-description" className="mt-2 text-sm font-bold text-gray-500">{celebration.subtitle}</p><div className="mt-6 grid gap-2">{onOpenPetRoom && <button type="button" onClick={goPetRoom} className="w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">{celebration.item.type === 'food' ? 'Использовать в комнате' : 'Открыть комнату питомца'}</button>}<button type="button" onClick={onClose} className="w-full rounded-2xl bg-indigo-50 px-5 py-3 font-black text-indigo-700">Отлично</button></div></motion.div></div>;
};

export const Shop: React.FC<ShopProps> = ({ userProfile, onBuy, onClose, onOpenPetRoom }) => {
  const [activeTab, setActiveTab] = useState<VisibleShopTab>('food');
  const [showOnlyAffordable, setShowOnlyAffordable] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [pulseItemId, setPulseItemId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<PurchaseCelebration | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [localProfile, setLocalProfile] = useState<UserProfile>(userProfile);
  const lastExternalProfileKey = useRef(getProfileSyncKey(userProfile));
  const mountedRef = useRef(true);
  const purchaseInFlightRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { const key = getProfileSyncKey(userProfile); if (key !== lastExternalProfileKey.current) { lastExternalProfileKey.current = key; setLocalProfile(userProfile); } }, [userProfile]);
  const activeProfile = localProfile;
  const allItems = getShopItemsByType(activeTab).filter(item => !item.characterType || item.characterType === activeProfile.pet.type);
  const affordableItems = allItems.filter(item => activeProfile.pet.level >= item.minLevel && activeProfile.coins >= item.price && !(getInventoryQuantity(activeProfile.inventory, item.id) > 0 && item.type !== 'food' && item.type !== 'mystery'));
  const filteredItems = useMemo(() => {
    const source = showOnlyAffordable ? affordableItems : allItems;
    return [...source].sort((a, b) => {
      const aCan = activeProfile.pet.level >= a.minLevel && activeProfile.coins >= a.price;
      const bCan = activeProfile.pet.level >= b.minLevel && activeProfile.coins >= b.price;
      if (aCan !== bCan) return aCan ? -1 : 1;
      if (a.minLevel !== b.minLevel) return a.minLevel - b.minLevel;
      return a.price - b.price;
    });
  }, [showOnlyAffordable, affordableItems, allItems, activeProfile.coins, activeProfile.pet.level]);
  const setLocalAndRemember = (profile: UserProfile) => { setLocalProfile(profile); lastExternalProfileKey.current = getProfileSyncKey(profile); };
  const syncPurchase = async (item: ShopItem) => { if (onBuy) { await onBuy(item); return null; } return userService.buyCurrentUserItem(item); };
  const showQuantityPulse = (itemId: string) => { setPulseItemId(itemId); window.setTimeout(() => mountedRef.current && setPulseItemId(null), 900); };
  const handleBuy = async (item: ShopItem) => {
    if (purchaseInFlightRef.current) return;
    setPurchaseError(null);
    const check = canPurchaseItem(activeProfile, item);
    if (!check.ok) return;
    const optimistic = applyPurchaseLocally(activeProfile, item);
    if (!optimistic.ok || !optimistic.profile) return;
    purchaseInFlightRef.current = true; setBuyingId(item.id); setLocalAndRemember(optimistic.profile); showQuantityPulse(optimistic.awardedItem?.id || item.id);
    try {
      const serverProfile = await syncPurchase(item);
      if (serverProfile && mountedRef.current) setLocalAndRemember(serverProfile);
      if (mountedRef.current) { showQuantityPulse(optimistic.awardedItem?.id || item.id); const celebrationResult = shouldCelebratePurchase(item, optimistic.awardedItem); if (celebrationResult) setCelebration(celebrationResult); }
    } catch (error: unknown) {
      if (mountedRef.current) { setLocalAndRemember(userProfile); setPurchaseError(error instanceof Error ? error.message : 'Покупка не сохранилась. Попробуйте ещё раз.'); }
    } finally { purchaseInFlightRef.current = false; if (mountedRef.current) setBuyingId(null); }
  };
  return <div className="mx-auto flex max-w-5xl flex-col p-3 pb-24 sm:p-4">
    <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5"><button type="button" aria-label="На главный экран" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><h2 className="min-w-0 flex-1 text-center text-2xl font-black text-indigo-900 sm:text-3xl">Магазин</h2><div className="flex h-11 items-center gap-2 rounded-2xl border-2 border-yellow-200 bg-yellow-50 px-3"><span className="text-lg font-black text-yellow-700">{activeProfile.coins}</span><CoinIcon /></div></div>
    {purchaseError && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><span>{purchaseError}</span><button type="button" aria-label="Закрыть ошибку покупки" onClick={() => setPurchaseError(null)} className="font-black">×</button></div>}
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="overflow-x-auto"><div className="flex w-max gap-2 rounded-2xl bg-indigo-50 p-1" role="tablist" aria-label="Разделы магазина">{VISIBLE_SHOP_TABS.map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} aria-controls={`shop-panel-${tab}`} disabled={Boolean(buyingId)} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 font-bold ${activeTab === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400'}`}>{getTabLabel(tab)}</button>)}</div></div><button type="button" aria-pressed={showOnlyAffordable} onClick={() => setShowOnlyAffordable(value => !value)} className={`rounded-2xl px-4 py-2 text-sm font-black ${showOnlyAffordable ? 'bg-green-600 text-white' : 'bg-white text-green-700 border-2 border-green-100'}`}>{showOnlyAffordable ? 'Показать всё' : `Можно купить (${affordableItems.length})`}</button></div>
    <div id={`shop-panel-${activeTab}`} role="tabpanel" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">{filteredItems.map(item => { const locked = activeProfile.pet.level < item.minLevel; const affordable = activeProfile.coins >= item.price; const missing = Math.max(0, item.price - activeProfile.coins); const qty = getInventoryQuantity(activeProfile.inventory, item.id); const owned = qty > 0 && item.type !== 'food' && item.type !== 'mystery'; const imageUrl = getShopImageUrl(item); const canBuy = !locked && affordable && !owned && !buyingId; return <motion.div key={item.id} whileHover={{ y: locked ? 0 : -4 }} className={`relative rounded-3xl border-2 bg-white p-5 shadow-sm ${canBuy ? 'border-green-200 ring-2 ring-green-50' : 'border-indigo-50'}`}>{canBuy && <div className="absolute left-4 top-4 rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">Можно купить</div>}{locked && <div className="absolute right-4 top-4 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">Ур. {item.minLevel}</div>}{owned && <div className="absolute right-4 top-4 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Есть</div>}{qty > 0 && item.type === 'food' && <div className={`absolute right-4 top-4 rounded-full bg-pink-500 px-3 py-1 text-sm font-black text-white ${pulseItemId === item.id ? 'scale-125 animate-bounce' : ''}`}>×{qty}</div>}<div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-indigo-50">{imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-contain" /> : <span className="text-5xl">🎁</span>}</div><h3 className="mb-2 text-center text-xl font-bold text-indigo-900">{item.name}</h3><p className="min-h-[42px] text-center text-sm text-gray-500">{item.description}</p><p className="mt-2 text-center text-xs font-bold text-indigo-500">{getItemBenefitText(item)}</p><div className="mb-3 mt-4 flex items-center justify-center gap-2 font-bold text-yellow-700"><span>{item.price}</span><CoinIcon /></div>{!locked && !affordable && !owned && <p className="mb-3 text-center text-xs font-bold text-gray-500">Не хватает {missing} монет · сыграйте ещё</p>}<button type="button" disabled={!canBuy} onClick={() => handleBuy(item)} className={`w-full rounded-2xl py-3 font-bold ${canBuy ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{buyingId === item.id ? 'Сохраняю...' : owned ? 'Уже есть' : !affordable ? 'Не хватает монет' : 'Купить'}</button></motion.div>; })}</div>
    {filteredItems.length === 0 && <div className="rounded-3xl bg-white p-8 text-center font-black text-gray-500">Сейчас нет доступных предметов в этом фильтре.</div>}
    {celebration && <PurchaseCelebrationModal celebration={celebration} onClose={() => setCelebration(null)} onOpenPetRoom={onOpenPetRoom} />}
  </div>;
};
