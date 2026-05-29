import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShopItem, UserProfile } from '../types';
import { applyItemUseLocally, applyPurchaseLocally } from '../services/economyEngine';
import { getCharacterProgressPercent, getCharacterStageLabel } from '../services/gamificationRules';
import { getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';
import { getInventoryImageUrl, getPuppyCharacterAssetUrl, getShopImageUrl } from '../services/petAssets';
import { getShopItemsByType } from '../services/shopCatalog';
import { CoinIcon } from './CoinIcon';

interface Props {
  userProfile: UserProfile;
  onUseItem: (itemId: string) => Promise<void>;
  onBuy: (item: ShopItem) => Promise<void>;
  onClose: () => void;
  onOpenShop?: () => void;
}
type Tab = 'food' | 'accessory';
const tabs: Tab[] = ['food', 'accessory'];
const label = (tab: Tab) => tab === 'food' ? 'Лакомства' : 'Гардероб';
const phrase = (profile: UserProfile) => getPetNeedSnapshot(profile.pet).moodScore <= 45 ? 'Купим лакомство?' : 'Сыграем ещё?';

export const PetRoom: React.FC<Props> = ({ userProfile, onUseItem, onBuy, onClose, onOpenShop }) => {
  const [profile, setProfile] = useState(userProfile);
  const [tab, setTab] = useState<Tab>('food');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speech, setSpeech] = useState(phrase(userProfile));
  useEffect(() => { setProfile(userProfile); setSpeech(phrase(userProfile)); }, [userProfile]);
  const pet = profile.pet;
  const mood = getPetNeedSnapshot(pet);
  const inventory = getVisibleInventory(profile, tab);
  const characterUrl = getPuppyCharacterAssetUrl(pet);
  const xp = getCharacterProgressPercent(pet);
  const roomUrl = pet.type === 'Puppy' ? '/assets/rooms/puppy/background.webp' : null;
  const owned = new Set(profile.inventory.map(item => item.id));
  const available = getShopItemsByType(tab).filter(item => pet.level >= item.minLevel && profile.coins >= item.price && (item.type === 'food' || !owned.has(item.id)));

  const useItem = async (itemId: string) => {
    const optimistic = applyItemUseLocally(profile, itemId);
    if (!optimistic.ok || !optimistic.profile) return;
    setProfile(optimistic.profile); setBusy(itemId);
    try { await onUseItem(itemId); } finally { setBusy(null); }
  };
  const buy = async (item: ShopItem) => {
    setError(null);
    const optimistic = applyPurchaseLocally(profile, item);
    if (!optimistic.ok || !optimistic.profile) return;
    setProfile(optimistic.profile); setBusy(item.id);
    try { await onBuy(item); }
    catch (reason: unknown) { setProfile(userProfile); setError(reason instanceof Error ? reason.message : 'Покупка не сохранилась. Попробуйте ещё раз.'); }
    finally { setBusy(null); }
  };

  return <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 sm:px-4">
    <header className="mb-4 flex items-center justify-between"><button type="button" onClick={onClose} className="h-11 w-11 rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><div className="text-center"><h1 className="text-xl font-black text-indigo-950 sm:text-3xl">Комната питомца</h1><p className="text-xs font-black uppercase text-indigo-300">{pet.name}</p></div><div className="h-11 w-11" /></header>
    {error && <div role="alert" className="mb-4 flex justify-between rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><span>{error}</span><button type="button" onClick={() => setError(null)}>×</button></div>}
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-[2rem] border-2 border-white bg-white shadow-sm sm:overflow-hidden">
        <div className={`relative min-h-[420px] w-[660px] sm:min-h-[540px] sm:w-full ${roomUrl ? 'bg-cover bg-center bg-no-repeat' : 'bg-gradient-to-b from-sky-100 to-amber-50'}`} style={roomUrl ? { backgroundImage: `url('${roomUrl}')` } : undefined}>
          <motion.button type="button" onClick={() => setSpeech(phrase(profile))} animate={{ y: mood.mood === 'sad' ? [0, -4, 0] : [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute bottom-20 left-1/2 h-56 w-56 -translate-x-1/2 sm:h-72 sm:w-72">{characterUrl ? <img src={characterUrl} alt={pet.name} className="h-full w-full object-contain" /> : <span className="text-8xl">{getPetEmoji(pet)}</span>}</motion.button>
          <div className="absolute right-4 top-4 rounded-3xl bg-white/90 px-4 py-3 text-sm font-bold text-indigo-900">“{speech}”</div>
        </div>
        <p className="py-2 text-center text-xs font-bold text-indigo-400 sm:hidden">Проведите по комнате влево или вправо</p>
      </div>
      <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5"><h2 className="text-2xl font-black text-indigo-950">{pet.name}</h2><p className="text-sm font-bold text-indigo-500">Уровень {pet.level} · {getCharacterStageLabel(pet.stage)}</p><div className="mt-5 flex justify-between text-xs font-black uppercase text-indigo-300"><span>Опыт</span><span>{pet.xp}</span></div><div className="mt-2 h-3 rounded-full bg-indigo-50"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${xp}%` }} /></div></aside>
    </section>
    <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black text-indigo-950">Мои предметы</h2><div className="flex rounded-2xl bg-indigo-50 p-1">{tabs.map(value => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl px-4 py-2 font-bold ${value === tab ? 'bg-white text-indigo-900' : 'text-indigo-400'}`}>{label(value)}</button>)}</div></div>
      {inventory.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{inventory.map(item => { const image = getInventoryImageUrl(item); return <button type="button" key={item.id} onClick={() => void useItem(item.id)} className="flex items-center gap-3 rounded-3xl border-2 border-indigo-100 p-3 text-left"><div className="h-16 w-16 rounded-2xl bg-indigo-50">{image && <img src={image} alt="" className="h-full w-full object-contain" />}</div><div className="font-black text-indigo-950">{item.name}</div>{busy === item.id && <span className="ml-auto text-xs text-indigo-400">…</span>}</button>; })}</div> : <div className="rounded-3xl border-2 border-dashed border-indigo-100 bg-indigo-50/50 p-8 text-center"><p className="font-black text-indigo-950">{tab === 'food' ? 'Лакомств пока нет' : 'Гардероб пока пуст'}</p>{onOpenShop && <button type="button" onClick={onOpenShop} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-white">В магазин</button>}</div>}
      {available.length > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{available.map(item => { const image = getShopImageUrl(item); return <div key={item.id} className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-indigo-200 p-3"><div className="h-16 w-16 rounded-2xl bg-white">{image && <img src={image} alt="" className="h-full w-full object-contain" />}</div><div><div className="font-black">{item.name}</div><div className="flex items-center gap-1 text-sm font-black text-yellow-700">{item.price}<CoinIcon /></div><button type="button" disabled={Boolean(busy)} onClick={() => void buy(item)} className="mt-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:bg-indigo-200">{busy === item.id ? 'Сохраняю...' : 'Купить'}</button></div></div>; })}</div>}
    </section>
  </div>;
};