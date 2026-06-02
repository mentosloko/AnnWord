import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { PetState, PetWorldId, ShopItem, UserProfile } from '../types';
import { applyItemUseLocally, applyPurchaseLocally, getPurchaseErrorMessage } from '../services/economyEngine';
import { getCharacterProgressPercent, getCharacterStageLabel } from '../services/gamificationRules';
import { getMoodDisplay } from '../services/moodDisplay';
import { getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';
import { getInventoryImageUrl, getPuppyCharacterAssetUrl, getShopImageUrl } from '../services/petAssets';
import { getShopItemById, getShopItemsByType } from '../services/shopCatalog';
import { getEarnedStickers, getLevelAvailableAccessories, getRequestedTreat, getUnlockedWorlds, getWorld, PET_WORLDS, STREAK_STICKERS } from '../services/premiumFeatureCatalog';
import { CoinIcon } from './CoinIcon';

interface Props {
  userProfile: UserProfile;
  onUseItem: (id: string) => Promise<void>;
  onBuy: (item: ShopItem) => Promise<void>;
  onUpdatePet?: (pet: PetState) => Promise<void>;
  onClose: () => void;
  onOpenShop?: () => void;
}

type Tab = 'food' | 'accessory';
const tabs: Tab[] = ['food', 'accessory'];
const tabTitle = (tab: Tab) => tab === 'food' ? 'Лакомства' : 'Гардероб';
const treatEffect = (id: string): string | null => {
  const mood = getShopItemById(id)?.effect?.mood;
  return typeof mood === 'number' ? `+${mood} к настроению` : null;
};
const petSpeech = (profile: UserProfile): string => {
  const treat = getRequestedTreat(profile);
  if (treat && treat.price > profile.coins) {
    const missing = treat.price - profile.coins;
    return `Мне так хочется «${treat.name}»! Не хватает ${missing} ${missing === 1 ? 'монеты' : 'монет'}.`;
  }
  return getPetNeedSnapshot(profile.pet).moodScore <= 45 ? 'Купим лакомство?' : 'Сыграем ещё?';
};

export const PetRoom: React.FC<Props> = ({ userProfile, onUseItem, onBuy, onUpdatePet, onClose, onOpenShop }) => {
  const [profile, setProfile] = useState(userProfile);
  const [tab, setTab] = useState<Tab>('food');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speech, setSpeech] = useState(petSpeech(userProfile));
  const roomViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setProfile(userProfile); setSpeech(petSpeech(userProfile)); }, [userProfile]);
  useEffect(() => {
    const viewport = roomViewportRef.current;
    if (!viewport) return;
    const centerOnPet = () => { viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2); };
    centerOnPet();
    const frame = window.requestAnimationFrame(centerOnPet);
    window.addEventListener('resize', centerOnPet);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', centerOnPet); };
  }, [profile.pet.type]);

  const pet = profile.pet;
  const mood = getPetNeedSnapshot(pet);
  const moodDisplay = getMoodDisplay(mood.moodScore);
  const items = getVisibleInventory(profile, tab);
  const picture = getPuppyCharacterAssetUrl(pet);
  const xp = getCharacterProgressPercent(pet);
  const activeWorld = getWorld(pet.activeWorldId);
  const unlockedWorldIds = new Set(getUnlockedWorlds(pet));
  const earnedStickers = getEarnedStickers(pet);
  const owned = new Set(profile.inventory.map(item => item.id));
  const equipped = new Set(pet.equippedAccessories || []);
  const requestedTreat = getRequestedTreat(profile);
  const unlockedAccessories = getLevelAvailableAccessories(pet.level);
  const nextAccessories = getShopItemsByType('accessory').filter(item => item.minLevel > pet.level).sort((a, b) => a.minLevel - b.minLevel).slice(0, 2);
  const offers = getShopItemsByType(tab).filter(item => pet.level >= item.minLevel && (item.type === 'food' || !owned.has(item.id)));

  const use = async (id: string) => {
    setError(null);
    const next = applyItemUseLocally(profile, id);
    if (!next.ok || !next.profile) {
      setError(getPurchaseErrorMessage(next.reason));
      if (next.reason === 'mood_full') setSpeech('Я уже в отличном настроении! Оставим лакомство на потом?');
      return;
    }
    setProfile(next.profile);
    setBusy(id);
    try { await onUseItem(id); } finally { setBusy(null); }
  };
  const buy = async (item: ShopItem) => {
    setError(null);
    const next = applyPurchaseLocally(profile, item);
    if (!next.ok || !next.profile) { setError(getPurchaseErrorMessage(next.reason)); return; }
    setProfile(next.profile); setBusy(item.id);
    try { await onBuy(item); } catch (purchaseError: unknown) { setProfile(userProfile); setError(purchaseError instanceof Error ? purchaseError.message : 'Покупка не сохранилась. Попробуйте ещё раз.'); } finally { setBusy(null); }
  };
  const selectWorld = async (worldId: PetWorldId) => {
    if (!unlockedWorldIds.has(worldId)) return;
    const nextPet = { ...pet, activeWorldId: worldId };
    setProfile(previous => ({ ...previous, pet: nextPet }));
    if (onUpdatePet) await onUpdatePet(nextPet);
  };

  return <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 sm:px-4">
    <header className="mb-4 flex items-center justify-between"><button type="button" aria-label="На главный экран" onClick={onClose} className="h-11 w-11 rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><div className="text-center"><h1 className="text-xl font-black text-indigo-950 sm:text-3xl">Комната питомца</h1><p className="text-xs font-black uppercase text-indigo-300">{pet.name}</p></div><div className="h-11 w-11" /></header>
    {error && <div role="alert" className="mb-4 flex justify-between rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><span>{error}</span><button type="button" onClick={() => setError(null)}>×</button></div>}
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div ref={roomViewportRef} className="overflow-x-auto rounded-[2rem] border-2 border-white bg-white shadow-sm sm:overflow-hidden">
        <div className={`relative min-h-[420px] w-[660px] bg-gradient-to-b ${activeWorld.backgroundClass} sm:min-h-[540px] sm:w-full`}>
          <div className="absolute left-4 top-4 rounded-full bg-white/85 px-4 py-2 text-xs font-black text-indigo-700">{activeWorld.emoji} {activeWorld.title}</div>
          <motion.button type="button" onClick={() => setSpeech(petSpeech(profile))} animate={{ y: mood.mood === 'sad' ? [0, -4, 0] : [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute bottom-20 left-1/2 h-56 w-56 -translate-x-1/2 sm:h-72 sm:w-72">
            {picture ? <img src={picture} alt={pet.name} className="h-full w-full object-contain" /> : <span className="text-8xl">{getPetEmoji(pet)}</span>}
          </motion.button>
          <div className="absolute right-4 top-16 max-w-[16rem] rounded-3xl bg-white/90 px-4 py-3 text-sm font-bold text-indigo-900">“{speech}”</div>
        </div>
      </div>
      <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5">
        <h2 className="text-2xl font-black text-indigo-950">{pet.name}</h2><p className="text-sm font-bold text-indigo-500">Уровень {pet.level} · {getCharacterStageLabel(pet.stage)}</p>
        <div className="mt-5 flex justify-between text-xs font-black uppercase text-indigo-300"><span>{moodDisplay.label}</span><span>{mood.moodScore}%</span></div><div className={`mt-2 h-3 overflow-hidden rounded-full ${moodDisplay.trackClass}`}><div className={`h-full rounded-full ${moodDisplay.barClass}`} style={{ width: `${mood.moodScore}%` }} /></div>
        {mood.moodScore < 34 && <p className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">Гардероб снят: питомцу грустно.</p>}
        <div className="mt-5 flex justify-between text-xs font-black uppercase text-indigo-300"><span>Опыт</span><span>{pet.xp}</span></div><div className="mt-2 h-3 rounded-full bg-indigo-50"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${xp}%` }} /></div>
        <div className="mt-5 rounded-2xl bg-amber-50 p-3"><div className="text-xs font-black uppercase text-amber-600">Серия дней</div><div className="mt-1 text-lg font-black text-indigo-950">🔥 {pet.dailyStreak || 0} дней</div><div className="mt-2 flex flex-wrap gap-2">{STREAK_STICKERS.map(sticker => <span key={sticker.id} title={`${sticker.days} дней`} className={`rounded-full px-2 py-1 text-sm ${earnedStickers.some(item => item.id === sticker.id) ? 'bg-white' : 'grayscale opacity-35'}`}>{sticker.emoji}</span>)}</div></div>
      </aside>
    </section>
    <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-4"><h2 className="text-lg font-black text-indigo-950">Фоны за ежедневные задания</h2><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{PET_WORLDS.map(world => { const unlocked = unlockedWorldIds.has(world.id); return <button type="button" key={world.id} disabled={!unlocked} onClick={() => void selectWorld(world.id)} className={`min-w-[138px] rounded-2xl border-2 p-3 text-left ${pet.activeWorldId === world.id || (!pet.activeWorldId && world.id === 'default_room') ? 'border-purple-400 bg-purple-50' : unlocked ? 'border-indigo-100' : 'border-gray-100 opacity-50'}`}><div className="text-2xl">{world.emoji}</div><div className="mt-1 text-xs font-black text-indigo-950">{world.title}</div><div className="text-[10px] font-bold text-gray-400">{unlocked ? 'Открыт' : 'Награда задания'}</div></button>; })}</div></section>
    {requestedTreat && requestedTreat.price > profile.coins && <section className="mt-5 flex items-center justify-between gap-3 rounded-[2rem] border-2 border-amber-100 bg-amber-50 p-4"><div><div className="text-xs font-black uppercase text-amber-600">Желание питомца</div><div className="font-black text-indigo-950">{requestedTreat.name}</div><div className="text-xs font-bold text-gray-500">Нужно ещё {requestedTreat.price - profile.coins} монет</div></div>{onOpenShop && <button type="button" onClick={onOpenShop} className="rounded-xl bg-amber-500 px-4 py-2 font-black text-white">В магазин</button>}</section>}
    <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-3 sm:p-4"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-base font-black text-indigo-950 sm:text-xl">Мои предметы</h2><div className="flex rounded-2xl bg-indigo-50 p-1">{tabs.map(value => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === tab ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400'}`}>{tabTitle(value)}</button>)}</div></div>
      {items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => { const image = getInventoryImageUrl(item); const isEquipped = tab === 'accessory' && equipped.has(item.id); const effect = tab === 'food' ? treatEffect(item.id) : null; return <button type="button" key={item.id} onClick={() => void use(item.id)} className={`relative flex items-center gap-3 rounded-3xl border-2 p-3 text-left ${isEquipped ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-100'}`}>{isEquipped && <span className="absolute right-3 top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">Надето</span>}<div className="h-16 w-16 rounded-2xl bg-indigo-50">{image && <img src={image} alt="" className="h-full w-full object-contain" />}</div><div className="font-black text-indigo-950">{item.name}{effect && <span className="block text-[11px] text-green-600">{effect}</span>}</div></button>; })}</div> : <div className="rounded-3xl border-2 border-dashed border-indigo-100 bg-indigo-50/50 p-8 text-center font-black text-indigo-950">{tab === 'food' ? 'Лакомств пока нет' : 'Гардероб пока пуст'}</div>}
      {tab === 'accessory' && <div className="mt-5 rounded-2xl bg-indigo-50 p-3"><div className="text-xs font-black uppercase text-indigo-500">Доступно на уровне {pet.level}</div><div className="mt-2 text-sm font-bold text-indigo-900">Открыто предметов: {unlockedAccessories.length}</div>{nextAccessories.map(item => <div key={item.id} className="mt-2 flex justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-500"><span>🔒 {item.name}</span><span>ур. {item.minLevel}</span></div>)}</div>}
      {offers.length > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{offers.map(item => { const image = getShopImageUrl(item); const affordable = profile.coins >= item.price; return <div key={item.id} className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-indigo-200 p-3"><div className="h-16 w-16">{image && <img src={image} alt="" className="h-full w-full object-contain" />}</div><div><div className="font-black">{item.name}</div><div className="flex items-center gap-1 text-sm font-black text-yellow-700">{item.price}<CoinIcon /></div><button type="button" disabled={!affordable || Boolean(busy)} onClick={() => void buy(item)} className="mt-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:bg-indigo-200">{affordable ? 'Купить' : 'Копить'}</button></div></div>; })}</div>}
    </section>
  </div>;
};