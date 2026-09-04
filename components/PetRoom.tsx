import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PetState, ShopItem, UserProfile } from '../types';
import { applyItemUseLocally, applyPurchaseLocally, getPurchaseErrorMessage } from '../services/economyEngine';
import { deriveCharacterStage, getCharacterStageLabel, getCharacterXpProgress } from '../services/gamificationRules';
import { getMoodDisplay } from '../services/moodDisplay';
import { getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';
import { getInventoryImageUrl, getPuppyCharacterAssetUrl, getShopImageUrl } from '../services/petAssets';
import { getShopItemById, getShopItemsByType } from '../services/shopCatalog';
import { getActiveWorld, getFulfilledRequestedTreat, getRequestedTreat, hasActiveDailyWorld, markRequestedTreatFulfilled } from '../services/premiumFeatureCatalog';
import { takePurchasedTreatForFeeding } from '../services/petFeedingHandoff';
import { CoinIcon } from './CoinIcon';
import { FloatingNotice } from './ui/StatusNotice';

interface Props { userProfile: UserProfile; onUseItem: (id: string) => Promise<void>; onBuy: (item: ShopItem) => Promise<void>; onUpdatePet?: (pet: PetState) => Promise<void>; onClose: () => void; onOpenShop?: () => void; }
type Tab = 'food' | 'accessory';
interface FeedingReaction { id: string; delta: number; image?: string; }
const tabs: Tab[] = ['food', 'accessory'];
const SHOP_TAB_STORAGE_KEY = 'annword_shop_initial_tab';
const title = (tab: Tab) => tab === 'food' ? 'Лакомства' : 'Гардероб';
const treatEffect = (id: string) => { const mood = getShopItemById(id)?.effect?.mood; return typeof mood === 'number' ? `+${mood} к настроению` : null; };
const PETTING_PHRASES = ['Мур… то есть гав! Мне нравится.', 'Ещё немножко!', 'Ты мой лучший друг!', 'Как приятно!', 'Я рад тебя видеть!'];
const JOY_PHRASES = ['Спасибо! У меня отличное настроение!', 'Я так рад тебя видеть!', 'Мне хорошо рядом с тобой!', 'Какой прекрасный день! Давай поиграем.', 'Спасибо за заботу! Я очень доволен.'];
const isHappyEnough = (profile: UserProfile) => getPetNeedSnapshot(profile.pet).moodScore > 45;
const joyPhrase = (profile: UserProfile) => JOY_PHRASES[Math.abs(Math.round((profile.pet.xp || 0) + profile.coins)) % JOY_PHRASES.length];
const say = (profile: UserProfile) => {
  const fulfilled = profile.featureFlags?.treatRequests ? getFulfilledRequestedTreat(profile) : null;
  if (fulfilled) return `Спасибо за «${fulfilled.name}»! Сегодня я уже доволен этим лакомством.`;
  if (isHappyEnough(profile)) return joyPhrase(profile);
  const treat = profile.featureFlags?.treatRequests ? getRequestedTreat(profile) : null;
  if (treat) return profile.coins >= treat.price ? `Я всё ещё хочу «${treat.name}». Купим?` : `Мне так хочется «${treat.name}»! Не хватает ${treat.price - profile.coins} монет.`;
  return 'Мне немного грустно. Поиграем или выберем лакомство?';
};
const feedingPhrase = (name: string, previousMood: number, nextMood: number, wasWanted: boolean) => {
  if (wasWanted) return `Ты запомнил! Это именно «${name}»! Спасибо! 🤩`;
  if (previousMood <= 33 && nextMood > 33) return 'Мне уже намного лучше! Спасибо! 💛';
  if (previousMood <= 66 && nextMood > 66) return 'Ура! Теперь у меня отличное настроение! 🌟';
  return `Ммм! «${name}»! Спасибо! 😊`;
};

export const PetRoom: React.FC<Props> = ({ userProfile, onUseItem, onBuy, onClose, onOpenShop }) => {
  const pendingTreatIdRef = useRef<string | null>(takePurchasedTreatForFeeding());
  const [profile, setProfile] = useState(userProfile);
  const [tab, setTab] = useState<Tab>('food');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speech, setSpeech] = useState(pendingTreatIdRef.current ? 'Ого! Ты принёс мне лакомство? 😍' : say(userProfile));
  const [pettingBurst, setPettingBurst] = useState(0);
  const [foodPickerOpen, setFoodPickerOpen] = useState(Boolean(pendingTreatIdRef.current));
  const [focusTreatId, setFocusTreatId] = useState<string | null>(pendingTreatIdRef.current);
  const [feedingReaction, setFeedingReaction] = useState<FeedingReaction | null>(null);
  const roomSceneRef = useRef<HTMLDivElement>(null);
  const reactionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setProfile(userProfile);
    if (!pendingTreatIdRef.current && !feedingReaction) setSpeech(say(userProfile));
  }, [userProfile]);
  useEffect(() => () => { if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current); }, []);

  const pet = profile.pet;
  const flags = profile.featureFlags || {};
  const mood = getPetNeedSnapshot(pet);
  const moodDisplay = getMoodDisplay(mood.moodScore);
  const items = getVisibleInventory(profile, tab);
  const foodItems = getVisibleInventory(profile, 'food');
  const sortedFoodItems = [...foodItems].sort((a, b) => a.id === focusTreatId ? -1 : b.id === focusTreatId ? 1 : 0);
  const picture = getPuppyCharacterAssetUrl(pet);
  const xp = getCharacterXpProgress(pet);
  const world = getActiveWorld(pet);
  const dailyWorld = flags.dailyWorldReward === true && hasActiveDailyWorld(pet);
  const room = dailyWorld ? world.backgroundImageUrl : pet.type === 'Puppy' ? '/assets/rooms/puppy/background.webp' : null;
  const owned = new Set(profile.inventory.map(item => item.id));
  const equipped = new Set(pet.equippedAccessories || []);
  const wantedTreat = flags.treatRequests && !isHappyEnough(profile) ? getRequestedTreat(profile) : null;
  const fulfilledTreat = flags.treatRequests ? getFulfilledRequestedTreat(profile) : null;
  const offers = getShopItemsByType(tab).filter(item => xp.level >= item.minLevel && profile.coins >= item.price && (item.type === 'food' || !owned.has(item.id)));

  const petPet = () => {
    const nextBurst = pettingBurst + 1;
    setPettingBurst(nextBurst);
    setSpeech(PETTING_PHRASES[nextBurst % PETTING_PHRASES.length]);
  };
  const openShop = (shopTab: Tab) => {
    try { window.sessionStorage.setItem(SHOP_TAB_STORAGE_KEY, shopTab); } catch { /* Navigation must still work if storage is unavailable. */ }
    onOpenShop?.();
  };
  const openFoodPicker = (preferredId?: string, bringRoomIntoView = false) => {
    if (preferredId) setFocusTreatId(preferredId);
    const show = () => setFoodPickerOpen(true);
    if (bringRoomIntoView && roomSceneRef.current) {
      roomSceneRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(show, 220);
    } else {
      show();
    }
  };

  const feed = async (id: string) => {
    setError(null);
    const currentItem = profile.inventory.find(item => item.id === id);
    if (!currentItem || currentItem.type !== 'food') return;
    const previousMood = getPetNeedSnapshot(profile.pet).moodScore;
    const next = applyItemUseLocally(profile, id);
    if (!next.ok || !next.profile) {
      setError(getPurchaseErrorMessage(next.reason));
      if (next.reason === 'mood_full') setSpeech('Спасибо! У меня уже отличное настроение. Оставим лакомство на потом?');
      return;
    }
    const nextMood = getPetNeedSnapshot(next.profile.pet).moodScore;
    const wasWanted = wantedTreat?.id === id;
    if (wasWanted) markRequestedTreatFulfilled(next.profile, id);
    const shopItem = getShopItemById(id);
    const image = getInventoryImageUrl(currentItem, pet) || (shopItem ? getShopImageUrl(shopItem, pet.type) : undefined);
    setProfile(next.profile);
    setBusy(id);
    setFoodPickerOpen(false);
    setFocusTreatId(id);
    pendingTreatIdRef.current = null;
    setPettingBurst(value => value + 1);
    setSpeech(feedingPhrase(currentItem.name, previousMood, nextMood, wasWanted));
    setFeedingReaction({ id: `${id}-${Date.now()}`, delta: Math.max(0, nextMood - previousMood), image: image || undefined });
    if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = window.setTimeout(() => setFeedingReaction(null), 1500);
    try {
      await onUseItem(id);
    } catch (useError: unknown) {
      setProfile(userProfile);
      setFeedingReaction(null);
      setError(useError instanceof Error ? useError.message : 'Не получилось сохранить кормление. Попробуйте ещё раз.');
    } finally {
      setBusy(null);
    }
  };

  const use = async (id: string) => {
    const currentItem = profile.inventory.find(item => item.id === id);
    if (currentItem?.type === 'food') {
      openFoodPicker(id, true);
      return;
    }
    setError(null);
    const next = applyItemUseLocally(profile, id);
    if (!next.ok || !next.profile) {
      setError(getPurchaseErrorMessage(next.reason));
      return;
    }
    setProfile(next.profile);
    setBusy(id);
    setSpeech('Как мне идёт новый образ?');
    try { await onUseItem(id); } finally { setBusy(null); }
  };

  const buy = async (item: ShopItem) => {
    setError(null);
    const next = applyPurchaseLocally(profile, item);
    if (!next.ok || !next.profile) return;
    setProfile(next.profile);
    setBusy(item.id);
    setSpeech(item.type === 'food' ? `«${item.name}» теперь у тебя. Угостим меня?` : say(next.profile));
    try {
      await onBuy(item);
      if (item.type === 'food') {
        setFocusTreatId(item.id);
        roomSceneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => setFoodPickerOpen(true), 220);
      }
    } catch (purchaseError: unknown) {
      setProfile(userProfile);
      setError(purchaseError instanceof Error ? purchaseError.message : 'Покупка не сохранилась. Попробуйте ещё раз.');
    } finally {
      setBusy(null);
    }
  };

  return <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 sm:px-4">
    <header className="mb-4 flex items-center justify-between"><button type="button" aria-label="На главный экран" onClick={onClose} className="h-11 w-11 rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><div className="text-center"><h1 className="text-xl font-black text-indigo-950 sm:text-3xl">Комната питомца</h1><p className="text-xs font-black uppercase text-indigo-300">{pet.name}</p></div><div className="h-11 w-11" /></header>
    <FloatingNotice message={error} tone="error" role="alert" />
    <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div ref={roomSceneRef} className="relative min-h-[500px] w-full overflow-hidden rounded-[2rem] bg-white shadow-sm sm:min-h-[560px]" style={room ? { backgroundImage: `url('${room}')`, backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}>
        {!room && <div className={`absolute inset-0 bg-gradient-to-b ${world.backgroundClass}`} />}
        {dailyWorld && <div className="absolute left-4 top-4 z-30 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-indigo-700">{world.emoji} Фон дня: {world.title}</div>}
        <div className="absolute left-3 top-3 z-30 rounded-2xl bg-white/92 px-3 py-2 shadow-sm backdrop-blur sm:left-5 sm:top-5 sm:px-4 sm:py-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300 sm:text-xs">Настроение</div>
          <div className="mt-1 flex items-center gap-2"><span className="text-sm font-black text-indigo-950 sm:text-lg">{moodDisplay.label}</span><motion.span key={mood.moodScore} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`text-xs font-black sm:text-sm ${moodDisplay.textClass}`}>{mood.moodScore}%</motion.span></div>
          <div className={`mt-2 h-2 w-28 overflow-hidden rounded-full sm:h-2.5 sm:w-44 ${moodDisplay.trackClass}`}><motion.div className={`h-full rounded-full ${moodDisplay.barClass}`} animate={{ width: `${mood.moodScore}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} /></div>
        </div>
        <motion.button key={`pet-${pettingBurst}`} type="button" aria-label={`Погладить питомца ${pet.name}`} title={`Погладить питомца ${pet.name}`} onClick={petPet} initial={false} animate={feedingReaction || pettingBurst ? { y: [0, -16, 0], rotate: [0, -3, 3, 0], scale: [1, 1.06, 1] } : { y: mood.mood === 'sad' ? [0, -4, 0] : [0, -9, 0] }} transition={feedingReaction || pettingBurst ? { duration: 0.7, ease: 'easeOut' } : { repeat: Infinity, duration: 3 }} whileTap={{ scale: 0.95 }} className="absolute bottom-16 left-1/2 z-10 h-60 w-60 -translate-x-1/2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400 sm:bottom-20 sm:h-80 sm:w-80">{picture ? <img src={picture} alt="" aria-hidden="true" className="h-full w-full object-contain drop-shadow-xl" /> : <span className="text-8xl" aria-hidden="true">{getPetEmoji(pet)}</span>}</motion.button>
        <AnimatePresence>
          {feedingReaction ? <>
            {feedingReaction.image && <motion.img key={`${feedingReaction.id}-treat`} src={feedingReaction.image} alt="" aria-hidden="true" initial={{ opacity: 0, y: 75, x: -80, scale: 0.65, rotate: -12 }} animate={{ opacity: [0, 1, 1, 0], y: [75, 20, -10, -28], x: [-80, -45, -15, 0], scale: [0.65, 0.9, 0.72, 0.5], rotate: [-12, 4, 0, 0] }} transition={{ duration: 0.8, ease: 'easeOut' }} className="pointer-events-none absolute bottom-48 left-1/2 z-20 h-16 w-16 object-contain sm:bottom-60 sm:h-20 sm:w-20" />}
            <motion.div key={`${feedingReaction.id}-burst`} aria-hidden="true" initial={{ opacity: 0, y: 18, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], y: [18, -4, -48, -74], scale: [0.5, 1.2, 1, 0.9] }} transition={{ duration: 1.35, delay: 0.2 }} className="pointer-events-none absolute bottom-64 left-1/2 z-30 -translate-x-1/2 text-3xl drop-shadow sm:bottom-80 sm:text-5xl">✨ 💛 ✨</motion.div>
            <motion.div key={`${feedingReaction.id}-delta`} initial={{ opacity: 0, y: 12, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: [12, -5, -24, -34], scale: [0.8, 1.12, 1, 0.95] }} transition={{ duration: 1.2, delay: 0.3 }} className="pointer-events-none absolute bottom-40 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3 py-2 text-sm font-black text-white shadow-lg sm:bottom-52 sm:px-4 sm:text-lg">+{feedingReaction.delta} настроение</motion.div>
          </> : pettingBurst > 0 && <motion.div key={pettingBurst} aria-hidden="true" initial={{ opacity: 0, y: 20, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], y: [20, -10, -55, -85], scale: [0.6, 1.1, 1, 0.9] }} transition={{ duration: 1.4 }} className="pointer-events-none absolute bottom-72 left-1/2 z-20 -translate-x-1/2 text-4xl drop-shadow">💛 ✨ 💛</motion.div>}
        </AnimatePresence>
        <motion.div key={speech} role="status" aria-live="polite" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute right-3 top-28 z-30 w-[58%] max-w-[22rem] rounded-2xl bg-white/95 px-3 py-3 text-center text-xs font-black leading-snug text-indigo-950 shadow-lg backdrop-blur sm:right-6 sm:top-24 sm:rounded-[1.6rem] sm:px-5 sm:py-4 sm:text-lg">“{speech}”</motion.div>
        <div className="absolute inset-x-0 bottom-0 z-40 p-3 lg:hidden"><button type="button" onClick={() => openFoodPicker()} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-4 text-lg font-black text-white shadow-xl shadow-violet-900/20 active:scale-[0.98]"><span aria-hidden="true">🍎</span> Покормить</button></div>
      </div>
      <aside className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5"><h2 className="text-2xl font-black text-indigo-950">{pet.name}</h2><p className="text-sm font-bold text-indigo-500">Уровень {xp.level} · {getCharacterStageLabel(deriveCharacterStage(xp.level))}</p><button type="button" onClick={petPet} className="mt-4 w-full rounded-2xl bg-pink-50 px-4 py-3 text-sm font-black text-pink-700 transition hover:bg-pink-100">💛 Погладить</button><div className="mt-5 flex justify-between text-xs font-black uppercase text-indigo-300"><span>{moodDisplay.label}</span><span>{mood.moodScore}%</span></div><div className={`mt-2 h-3 overflow-hidden rounded-full ${moodDisplay.trackClass}`}><motion.div className={`h-full rounded-full ${moodDisplay.barClass}`} animate={{ width: `${mood.moodScore}%` }} /></div>{flags.levelWardrobe && profile.petWardrobeAutoRemoved && mood.moodScore < 34 && <p className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">Мне грустно, поэтому я снял наряд. Он остаётся в гардеробе.</p>}<div className="mt-5 text-xs font-black uppercase text-indigo-300">Опыт · {xp.currentLevelXp}/{xp.xpForNextLevel} XP</div><div className="mt-2 h-3 rounded-full bg-indigo-50"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${xp.percent}%` }} /></div><div className="mt-6 hidden border-t border-indigo-50 pt-5 lg:block"><div className="text-xs font-black uppercase tracking-wider text-indigo-300">Лакомства</div><h3 className="mt-1 text-lg font-black text-indigo-950">Чем угостим?</h3>{sortedFoodItems.length ? <div className="mt-3 grid gap-2">{sortedFoodItems.slice(0, 4).map(item => <button key={item.id} type="button" disabled={busy === item.id} onClick={() => void feed(item.id)} className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition disabled:opacity-50 ${focusTreatId === item.id ? 'border-violet-300 bg-violet-50' : 'border-indigo-50 hover:border-violet-200 hover:bg-violet-50'}`}><div className="relative h-12 w-12 shrink-0"><img src={getInventoryImageUrl(item, pet) || ''} alt="" className="h-full w-full object-contain" />{item.quantity > 1 && <span className="absolute -right-2 -top-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-black text-white">×{item.quantity}</span>}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-indigo-950">{item.name}</div>{treatEffect(item.id) && <div className="text-xs font-black text-emerald-600">{treatEffect(item.id)}</div>}</div></button>)}</div> : <div className="mt-3 rounded-2xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700">Лакомств пока нет.</div>}{onOpenShop && <button type="button" onClick={() => openShop('food')} className="mt-3 w-full rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-700">В магазин</button>}</div></aside>
    </section>
    {wantedTreat && <section className="mt-5 flex justify-between rounded-[2rem] border-2 border-amber-100 bg-amber-50 p-4"><div><div className="text-xs font-black text-amber-600">ЖЕЛАНИЕ ПИТОМЦА</div><div className="font-black">{wantedTreat.name}</div><div className="text-xs font-bold text-gray-500">{profile.coins >= wantedTreat.price ? 'Можно купить сейчас' : `Не хватает ${wantedTreat.price - profile.coins} монет`}</div></div>{onOpenShop && <button type="button" onClick={() => openShop('food')} className="rounded-xl bg-amber-500 px-4 py-2 font-black text-white">В магазин</button>}</section>}
    {fulfilledTreat && <section className="mt-5 rounded-[2rem] border-2 border-green-100 bg-green-50 p-4"><div className="text-xs font-black text-green-600">ЖЕЛАНИЕ ВЫПОЛНЕНО</div><div className="font-black text-green-900">Спасибо за «{fulfilledTreat.name}»! Новое желание появится завтра.</div></section>}
    <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-white p-4"><div className="mb-4 flex justify-between"><h2 className="text-xl font-black">Мои предметы</h2><div className="flex rounded-2xl bg-indigo-50 p-1">{tabs.map(value => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === tab ? 'bg-white text-indigo-900' : 'text-indigo-400'}`}>{title(value)}</button>)}</div></div>{items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <button key={item.id} type="button" onClick={() => void use(item.id)} disabled={busy === item.id} className={`relative flex items-center gap-3 rounded-3xl border-2 p-3 text-left transition disabled:opacity-60 ${tab === 'accessory' && equipped.has(item.id) ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-100'}`}><div className="h-16 w-16">{getInventoryImageUrl(item, pet) && <img src={getInventoryImageUrl(item, pet) || ''} alt="" className="h-full w-full object-contain" />}</div>{item.quantity > 1 && <span className="absolute right-3 top-3 rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white">×{item.quantity}</span>}<div className="font-black">{item.name}{tab === 'food' && treatEffect(item.id) && <span className="block text-xs text-green-600">{treatEffect(item.id)} · выбрать</span>}{tab === 'accessory' && equipped.has(item.id) && <span className="block text-xs text-indigo-600">Надето</span>}</div></button>)}</div> : <div className="rounded-2xl bg-indigo-50/60 p-6 text-center"><div className="font-black text-indigo-950">{tab === 'food' ? 'Лакомств пока нет' : 'Гардероб пока пуст'}</div>{onOpenShop && <button type="button" onClick={() => openShop(tab)} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">Перейти в магазин</button>}</div>}</section>
    {offers.length > 0 && <section className="mt-5 rounded-[2rem] border-2 border-amber-50 bg-white p-4"><h2 className="text-xl font-black">Можно купить сейчас</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{offers.slice(0, 3).map(item => <button key={item.id} type="button" onClick={() => void buy(item)} disabled={busy === item.id} className="flex items-center gap-3 rounded-3xl border-2 border-amber-100 p-3 text-left transition hover:bg-amber-50 disabled:opacity-60"><div className="h-16 w-16">{getShopImageUrl(item, pet.type) && <img src={getShopImageUrl(item, pet.type)} alt="" className="h-full w-full object-contain" />}</div><div className="min-w-0 flex-1"><div className="font-black">{item.name}</div><div className="flex items-center gap-1 text-xs font-black text-amber-700">{item.price}<CoinIcon /></div></div></button>)}</div></section>}
    <AnimatePresence>
      {foodPickerOpen && <div className="fixed inset-0 z-[100] lg:hidden"><motion.button type="button" aria-label="Закрыть выбор лакомства" onClick={() => setFoodPickerOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-indigo-950/35 backdrop-blur-[1px]" /><motion.section role="dialog" aria-modal="true" aria-label="Выбор лакомства" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="absolute inset-x-0 bottom-0 max-h-[56vh] overflow-y-auto rounded-t-[2rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"><div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" /><div className="mt-3 flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wider text-indigo-300">Лакомства</div><h2 className="text-xl font-black text-indigo-950">Чем угостим {pet.name}?</h2></div><button type="button" onClick={() => setFoodPickerOpen(false)} className="h-10 w-10 rounded-full bg-indigo-50 text-lg font-black text-indigo-500">×</button></div>{sortedFoodItems.length ? <div className="mt-4 grid grid-cols-3 gap-2.5">{sortedFoodItems.map(item => <button key={item.id} type="button" disabled={busy === item.id} onClick={() => void feed(item.id)} className={`relative flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 p-2 text-center active:scale-[0.97] disabled:opacity-40 ${focusTreatId === item.id ? 'border-violet-300 bg-violet-50' : 'border-indigo-50 bg-white'}`}><div className="relative h-16 w-16"><img src={getInventoryImageUrl(item, pet) || ''} alt="" className="h-full w-full object-contain" /><span className="absolute -right-2 -top-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-black text-white">×{item.quantity}</span></div><div className="mt-1 line-clamp-2 text-xs font-black text-indigo-950">{item.name}</div>{treatEffect(item.id) && <div className="text-[11px] font-black text-emerald-600">{treatEffect(item.id)}</div>}</button>)}</div> : <div className="mt-4 rounded-2xl bg-indigo-50 p-5 text-center"><div className="font-black text-indigo-950">Лакомств пока нет</div>{onOpenShop && <button type="button" onClick={() => { setFoodPickerOpen(false); openShop('food'); }} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">Перейти в магазин</button>}</div>}</motion.section></div>}
    </AnimatePresence>
  </div>;
};
