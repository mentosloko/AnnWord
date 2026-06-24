import { PetState, PetWorldId, ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from './shopCatalog';

export interface PetWorldDefinition { id: PetWorldId; title: string; emoji: string; description: string; backgroundImageUrl?: string; backgroundClass: string; }
export interface StreakSticker { id: string; days: number; title: string; emoji: string; description: string; }

export const PET_WORLDS: PetWorldDefinition[] = [
  { id: 'default_room', title: 'Комната', emoji: '🛋️', description: 'Домашняя комната питомца', backgroundImageUrl: '/assets/rooms/puppy/background.webp', backgroundClass: 'from-sky-100 to-amber-50' },
  { id: 'theatre', title: 'Театр', emoji: '🎭', description: 'Фон дня за ежедневное задание', backgroundImageUrl: '/assets/rooms/daily/theatre.webp', backgroundClass: 'from-rose-100 to-purple-200' },
  { id: 'amusement_park', title: 'Аттракционы', emoji: '🎡', description: 'Фон дня за ежедневное задание', backgroundImageUrl: '/assets/rooms/daily/amusement-park.webp', backgroundClass: 'from-cyan-100 to-yellow-100' },
  { id: 'ice_rink', title: 'Каток', emoji: '⛸️', description: 'Фон дня за ежедневное задание', backgroundImageUrl: '/assets/rooms/daily/ice-rink.webp', backgroundClass: 'from-sky-50 to-blue-200' },
  { id: 'opera', title: 'Опера', emoji: '🎼', description: 'Фон дня за ежедневное задание', backgroundImageUrl: '/assets/rooms/daily/opera.webp', backgroundClass: 'from-indigo-100 to-amber-100' },
  { id: 'sausage_fridge', title: 'Холодильник с сосисками', emoji: '🌭', description: 'Фон дня за ежедневное задание', backgroundImageUrl: '/assets/rooms/daily/sausage-fridge.webp', backgroundClass: 'from-teal-50 to-orange-100' },
];
export const STREAK_STICKERS: StreakSticker[] = [
  { id: 'streak_3', days: 3, title: 'Звёздный старт', emoji: '⭐', description: '3 дня подряд' },
  { id: 'streak_7', days: 7, title: 'Огонёк недели', emoji: '🔥', description: '7 дней подряд' },
  { id: 'streak_14', days: 14, title: 'Медаль друга', emoji: '🏅', description: '14 дней подряд' },
  { id: 'streak_30', days: 30, title: 'Кубок героя', emoji: '🏆', description: '30 дней подряд' },
];

const moscowDateKey = (date = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const treatRequestStorageKey = (profile: UserProfile) => `annword:treat-request:${profile.username || 'guest'}:${moscowDateKey()}`;
const treatFulfilledStorageKey = (profile: UserProfile) => `annword:treat-request-fulfilled:${profile.username || 'guest'}:${moscowDateKey()}`;
const readStoredTreatId = (profile: UserProfile): string | null => {
  if (typeof window === 'undefined') return profile.pet.requestedTreatId || null;
  return window.localStorage.getItem(treatRequestStorageKey(profile)) || profile.pet.requestedTreatId || null;
};
const storeTreatId = (profile: UserProfile, itemId: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(treatRequestStorageKey(profile), itemId); };
const readFulfilledTreatId = (profile: UserProfile): string | null => typeof window === 'undefined' ? null : window.localStorage.getItem(treatFulfilledStorageKey(profile));

export const markRequestedTreatFulfilled = (profile: UserProfile, itemId: string): void => {
  if (typeof window === 'undefined') return;
  const requestedId = readStoredTreatId(profile);
  if (requestedId === itemId) window.localStorage.setItem(treatFulfilledStorageKey(profile), itemId);
};
export const getFulfilledRequestedTreat = (profile: UserProfile): ShopItem | null => {
  const fulfilledId = readFulfilledTreatId(profile);
  if (!fulfilledId) return null;
  return getShopItemsByType('food').find(item => item.id === fulfilledId) || null;
};
export const getWorld = (id?: PetWorldId): PetWorldDefinition => PET_WORLDS.find(world => world.id === id) || PET_WORLDS[0];
export const getActiveWorld = (pet: PetState): PetWorldDefinition => pet.activeWorldDate === moscowDateKey() ? getWorld(pet.activeWorldId) : PET_WORLDS[0];
export const hasActiveDailyWorld = (pet: PetState): boolean => pet.activeWorldDate === moscowDateKey() && pet.activeWorldId !== undefined && pet.activeWorldId !== 'default_room';
export const getEarnedStickers = (pet: PetState): StreakSticker[] => STREAK_STICKERS.filter(sticker => (pet.earnedStickerIds || []).includes(sticker.id) || (pet.dailyStreak || 0) >= sticker.days);
export const getLevelAvailableAccessories = (level: number): ShopItem[] => getShopItemsByType('accessory').filter(item => item.minLevel <= level);
export const getRequestedTreat = (profile: UserProfile): ShopItem | null => {
  if (getFulfilledRequestedTreat(profile)) return null;
  const foods = getShopItemsByType('food').sort((a, b) => a.price - b.price);
  const storedId = readStoredTreatId(profile);
  const storedTreat = foods.find(item => item.id === storedId);
  if (storedTreat) return storedTreat;
  const nextTreat = foods.find(item => item.price > profile.coins) || foods[foods.length - 1] || null;
  if (nextTreat) storeTreatId(profile, nextTreat.id);
  return nextTreat;
};