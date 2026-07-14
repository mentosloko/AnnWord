import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PetState, ShopItem, UserProfile } from '../types';
import { applyItemUseLocally, applyPurchaseLocally, getPurchaseErrorMessage } from '../services/economyEngine';
import { getCharacterProgressPercent, getCharacterStageLabel } from '../services/gamificationRules';
import { getMoodDisplay } from '../services/moodDisplay';
import { getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';
import { getInventoryImageUrl, getPuppyCharacterAssetUrl, getShopImageUrl } from '../services/petAssets';
import { getShopItemById, getShopItemsByType } from '../services/shopCatalog';
import { getActiveWorld, getEarnedStickers, getFulfilledRequestedTreat, getLevelAvailableAccessories, getRequestedTreat, hasActiveDailyWorld, markRequestedTreatFulfilled, STREAK_STICKERS } from '../services/premiumFeatureCatalog';
import { CoinIcon } from './CoinIcon';

interface Props { userProfile: UserProfile; onUseItem: (id: string) => Promise<void>; onBuy: (item: ShopItem) => Promise<void>; onUpdatePet?: (pet: PetState) => Promise<void>; onClose: () => void; onOpenShop?: () => void; }
type Tab = 'food' | 'accessory';
const tabs: Tab[] = ['food', 'accessory'];
const title = (tab: Tab) => tab === 'food' ? 'Лакомства' : 'Гардероб';
const treatEffect = (id: string) => { const mood = getShopItemById(id)?.effect?.mood; return typeof mood === 'number' ? `+${mood} к настроению` : null; };
const PETTING_PHRASES = ['Мур… то есть гав! Мне нравится.', 'Ещё немножко!', 'Ты мой лучший друг!', 'Как приятно!', 'Я рад тебя видеть!'];
const dayLabel = (days: number): string => {
  const value = Math.max(0, Math.round(days || 0));
  const mod10 = value % 10;
  const mod100 = value % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня' : 'дней';
  return `${value} ${noun}`;
};
const say = (profile: UserProfile) => {
  const fulfilled = profile.featureFlags?.treatRequests ? getFulfilledRequestedTreat(profile) : null;
  if (fulfilled) return `Спасибо за «${fulfilled.name}»! Сегодня я уже доволен этим лакомством.`;
  const treat = profile.featureFlags?.treatRequests ? getRequestedTreat(profile) : null;
  if (treat) return profile.coins >= treat.price ? `Я всё ещё хочу «${treat.name}». Купим?` : `Мне так хочется «${treat.name}»! Не хватает ${treat.price - profile.coins} монет.`;
  return getPetNeedSnapshot(profile.pet).moodScore <= 45 ? 'Купим лакомство?' : 'Сыграем ещё?';
};

export const PetRoom: React.FC<Props> = ({ userProfile, onUseItem, onBuy, onClose, onOpenShop }) => {
  const [profile, setProfile] = useState(userProfile);
  const [tab, setTab] = useState<Tab>('food');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speech, setSpeech] = useState(say(userProfile));
  const [feedback, setFeedback] = useState<{ title: string; detail: string; itemId?: string } | null>(null);
  const [pettingBurst, setPettingBurst] = useState(0);
  const roomViewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setProfile(userProfile); setSpeech(say(userProfile)); }, [userProfile]);
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null), 2600); return () => window.clearTimeout(timer); }, [feedback]);
  useEffect(() => { const viewport = roomViewportRef.current; if (!viewport) return; const center = () => { viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2); }; center(); const frame = window.requestAnimationFrame(center); window.addEventListener('resize', center); return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', center); }; }, [profile.pet.type]);

  const pet = profile.pet;
  const flags = profile.featureFlags || {};
  const mood = getPetNeedSnapshot(pet);
  const moodDisplay = getMoodDisplay(mood.moodScore);
  const items = getVisibleInventory(profile, tab);
  const picture = getPuppyCharacterAssetUrl(pet);
  const xp = getCharacterProgressPercent(pet);
  const world = getActiveWorld(pet);
  const dailyWorld = flags.dailyWorldReward === true && hasActiveDailyWorld(pet);
  const room = dailyWorld ? world.backgroundImageUrl : pet.type === 'Puppy' ? '/assets/rooms/puppy/background.webp' : null;
  const owned = new Set(profile.inventory.map(item => item.id));
  const equipped = new Set(pet.equippedAccessories || []);
  const wantedTreat = flags.treatRequests ? getRequestedTreat(profile) : null;
  const fulfilledTreat = flags.treatRequests ? getFulfilledRequestedTreat(profile) : null;
  const streakDays = Math.max(0, Math.round(pet.dailyStreak || 0));
  const stickers = flags.streakStickers ? getEarnedStickers(pet) : [];
  const nextSticker = flags.streakStickers ? STREAK_STICKERS.find(sticker => !stickers.some(item => item.id === sticker.id)) : undefined;
  const daysToNextSticker = nextSticker ? Math.max(0, nextSticker.days - streakDays) : 0;
  const accessories = flags.levelWardrobe ? getLevelAvailableAccessories(pet.level) : [];
  const nextAccessories = flags.levelWardrobe ? getShopItemsByType('accessory').filter(item => item.minLevel > pet.level).sort((a, b) => a.minLevel - b.minLevel).slice(0, 2) : [];
  const offers = getShopItemsByType(tab).filter(item => pet.level >= item.minLevel && profile.coins >= item.price && (item.type === 'food' || !owned.has(item.id)));

  const petPet = () => {
    const nextBurst = pettingBurst + 1;
    setPettingBurst(nextBurst);
    const phrase = PETTING_PHRASES[nextBurst % PETTING_PHRASES.length];
    setSpeech(phrase);
    setFeedback({ title: 'Питомец доволен', detail: `${pet.name}: «${phrase}»` });
  };

  const use = async (id: string) => {
    setError(null);
    const currentItem = profile.inventory.find(item => item.id === id);
    const shopItem = getShopItemById(id);
    const next = applyItemUseLocally(profile, id);
    if (!next.ok || !next.profile) {
      setError(getPurchaseErrorMessage(next.reason));
      if (next.reason === 'mood_full') setSpeech('Я уже в отличном настроении! Оставим лакомство на потом?');
      return;
    }
    if (wantedTreat?.id === id) markRequestedTreatFulfilled(profile, id);
    setProfile(next.profile);
    setBusy(id);
    const moodDelta = shopItem?.effect?.mood || 0;
    setSpeech(currentItem?.type === 'accessory' ? 'Как мне идёт новый образ?' : 'Спасибо! Мне стало веселее.');
    setFeedback({ title: currentItem?.type === 'accessory' ? 'Наряд обновлён' : wantedTreat?.id === id ? 'Желание выполнено' : 'Лакомство использовано', detail: currentItem?.type === 'accessory' ? `${currentItem.name} теперь на питомце.` : `${currentItem?.name || 'Лакомство'} · +${moodDelta} к настроению`, itemId: id });
    try { await onUseItem(id); } finally { setBusy(null); }
  };
  const buy = async (item: ShopItem) => {
    setError(null);
    const next = applyPurchaseLocally(profile, item);
    if (!next.ok || !next.profile) return;
    const wasWanted = wantedTreat?.id === item.id;
    if (wasWanted) markRequestedTreatFulfilled(profile, item.id);
    setProfile(next.profile);
    setSpeech(wasWanted ? `Спасибо за «${item.name}»! Сегодня я больше не буду просить другое лакомство.` : say(next.profile));
    setFeedback({ title: wasWanted ? 'Желание выполнено' : 'Покупка добавлена', detail: `${item.name} уже в предметах питомца.`, itemId: item.id });
    setBusy(item.id);
    try { await onBuy(item); } catch (purchaseError: unknown) { setProfile(userProfile); setError(purchaseError instanceof Error ? purchaseError.message : 'Покупка не сохранилась. Попробуйте ещё раз.'); } finally { setBusy(null); }
  };

  return <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 sm:px-4">
    <header className="mb-4 flex items-center justify-between"><button type="button" aria-label="На главный экран" onClick={onClose} className="h-11 w-11 rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><div className="text-center"><h1 className="text-xl font-black text-indigo-950 sm:text-3xl">Комната питомца</h1><p className="text-xs font-black uppercase text-indigo-300">{pet.name}</p></div><div className="h-11 w-11" /></header>
    {error && <div role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    <AnimatePresence>{feedback && <motion.div role="status" aria-live="polite" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-4 rounded-3xl border-2 border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800"><div className="text-base font-black">{feedback.title}</div><div>{feedback.detail}</div></motion.div>}</AnimatePresence>
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div ref={roomViewportRef} className="overflow-x-auto rounded-[2rem] bg-white shadow-sm sm:overflow-hidden"><div className={`relative min-h-[420px] w-[660px] sm:min-h-[540px] sm:w-full ${room ? 'bg-cover bg-center' : `bg-gradient-to-b ${world.backgroundClass}`}`} style={room ? { backgroundImage: `url('${room}')` } : undefined}>{dailyWorld && <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-indigo-700">{world.emoji} Фон дня: {world.title}</div>}<motion.button key={`pet-${pettingBurst}`} type="button" aria-label={`Погладить питомца ${pet.name}`} title={`Погладить питомца ${pet.name}`} onClick={petPet} initial={false} animate={pettingBurst ? { y: [0, -18, 0], rotate: [0, -4, 4, 0], scale: [1, 1.04, 1] } : { y: mood.mood === 'sad' ? [0, -4, 0] : [0, -10, 0] }} transition={pettingBurst ? { duration: 0.65 } : { repeat: Infinity, duration: 3 }} whileTap={{ scale: 0.95 }} className="absolute bottom-20 left-1/2 h-56 w-56 -translate-x-1/2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400 sm:h-72 sm:w-72">{picture ? <img src={picture} alt="" aria-hidden="true" className="h-full w-full object-contain" /> : <span className="text-8xl" aria-hidden="true">{getPetEmoji(pet)}</span>}</motion.button><AnimatePresence mode="popLayout">{pettingBurst > 0 && <motion.div key={pettingBurst} aria-hidden="true" initial={{ opacity: 0, y: 20, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], y: [20, -10, -55, -85], scale: [0.6, 1.1, 1, 0.9] }} transition={{ duration: 1.4 }} className="pointer-events-none absolute bottom-72 left-1/2 -translate-x-1/2 text-4xl drop-shadow">💛 ✨ 💛</motion.div>}</AnimatePresence><div className="absolute right-4 top-4 max-w-[16rem] rounded-3xl bg-white/90 px-4 py-3 text-sm font-bold text-indigo-900">“{speech}”</div>{feedback && <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute bottom-72 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-2 text-sm font-black text-white shadow-lg">{feedback.title}</motion.div>}</div></div>
      <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5"><h2 className="text-2xl font-black text-indigo-950">{pet.name}</h2><p className="text-sm font-bold text-indigo-500">Уровень {pet.level} · {getCharacterStageLabel(pet.stage)}</p><button type="button" onClick={petPet} className="mt-4 w-full rounded-2xl bg-pink-50 px-4 py-3 text-sm font-black text-pink-700 transition hover:bg-pink-100">💛 Погладить</button><div className="mt-5 flex justify-between text-xs font-black uppercase text-indigo-300"><span>{moodDisplay.label}</span><span>{mood.moodScore}%</span></div><div className={`mt-2 h-3 overflow-hidden rounded-full ${moodDisplay.trackClass}`}><div className={`h-full rounded-full ${moodDisplay.barClass}`} style={{ width: `${mood.moodScore}%` }} /></div>{flags.levelWardrobe && mood.moodScore < 34 && <p className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">Мне грустно, поэтому я снял наряд. Он остаётся в гардеробе.</p>}<div className="mt-5 text-xs font-black uppercase text-indigo-300">Опыт · {pet.xp}</div><div className="mt-2 h-3 rounded-full bg-indigo-50"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${xp}%` }} /></div>{flags.streakStickers && <div className="mt-5 rounded-2xl bg-amber-50 p-3"><div className="text-xs font-black text-amber-600">НАКЛЕЙКИ · {dayLabel(streakDays)}</div><div className="mt-2 flex gap-2">{STREAK_STICKERS.map(s => <span key={s.id} title={s.description} className={stickers.some(x => x.id === s.id) ? 'text-2xl' : 'text-2xl grayscale opacity-30'}>{s.emoji}</span>)}</div>{nextSticker && <div className="mt-2 text-[11px] font-bold text-amber-700">До «{nextSticker.title}» осталось: {dayLabel(daysToNextSticker)}</div>}</div>}</aside></section>
    {wantedTreat && <section className="mt-5 flex justify-between rounded-[2rem] border-2 border-amber-100 bg-amber-50 p-4"><div><div className="text-xs font-black text-amber-600">ЖЕЛАНИЕ ПИТОМЦА</div><div className="font-black">{wantedTreat.name}</div><div className="text-xs font-bold text-gray-500">{profile.coins >= wantedTreat.price ? 'Можно купить сейчас' : `Не хватает ${wantedTreat.price - profile.coins} монет`}</div></div>{onOpenShop && <button type="button" onClick={onOpenShop} className="rounded-xl bg-amber-500 px-4 py-2 font-black text-white">В магазин</button>}</section>}
    {fulfilledTreat && <section className="mt-5 rounded-[2rem] border-2 border-green-100 bg-green-50 p-4"><div className="text-xs font-black text-green-600">ЖЕЛАНИЕ ВЫПОЛНЕНО</div><div className="font-black text-green-900">Спасибо за «{fulfilledTreat.name}»! Новое желание появится завтра.</div></section>}
    <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-4"><div className="mb-4 flex justify-between"><h2 className="text-xl font-black">Мои предметы</h2><div className="flex rounded-2xl bg-indigo-50 p-1">{tabs.map(value => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === tab ? 'bg-white text-indigo-900' : 'text-indigo-400'}`}>{title(value)}</button>)}</div></div>{items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <button key={item.id} type="button" onClick={() => void use(item.id)} disabled={busy === item.id} className={`relative flex items-center gap-3 rounded-3xl border-2 p-3 text-left transition disabled:opacity-60 ${tab === 'accessory' && equipped.has(item.id) ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-100'}`}><div className="h-16 w-16">{getInventoryImageUrl(item) && <img src={getInventoryImageUrl(item)} alt="" className="h-full w-full object-contain" />}</div>{item.quantity > 1 && <span className="absolute right-3 top-3 rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white">×{item.quantity}</span>}<div className="font-black">{item.name}{tab === 'food' && treatEffect(item.id) && <span className="block text-xs text-green-600">{treatEffect(item.id)}</span>}{tab === 'accessory' && equipped.has(item.id) && <span className="block text-xs text-indigo-600">Надето</span>}</div></button>)}</div> : <div className="p-8 text-center font-black">{tab === 'food' ? 'Лакомств пока нет' : 'Гардероб пока пуст'}</div>}{flags.levelWardrobe && tab === 'accessory' && <div className="mt-5 rounded-2xl bg-indigo-50 p-3"><div className="text-sm font-bold">На уровне {pet.level} доступно предметов: {accessories.length}</div>{nextAccessories.map(item => <div key={item.id} className="mt-2 text-xs font-bold text-gray-500">🔒 {item.name} откроется на уровне {item.minLevel}</div>)}</div>}</section>
    {offers.length > 0 && <section className="mt-5 rounded-[2rem] border-2 border-amber-50 bg-white p-4"><h2 className="text-xl font-black">Можно купить сейчас</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{offers.slice(0, 3).map(item => <button key={item.id} type="button" onClick={() => void buy(item)} disabled={busy === item.id} className="flex items-center gap-3 rounded-3xl border-2 border-amber-100 p-3 text-left transition hover:bg-amber-50 disabled:opacity-60"><div className="h-16 w-16">{getShopImageUrl(item) && <img src={getShopImageUrl(item)} alt="" className="h-full w-full object-contain" />}</div><div className="min-w-0 flex-1"><div className="font-black">{item.name}</div><div className="flex items-center gap-1 text-xs font-black text-amber-700">{item.price}<CoinIcon /></div></div></button>)}</div></section>}
  </div>;
};