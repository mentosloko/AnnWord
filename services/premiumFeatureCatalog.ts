import { PetState, PetWorldId, ShopItem, UserProfile } from '../types';
import { getShopItemsByType } from './shopCatalog';

export interface PetWorldDefinition {
  id: PetWorldId;
  title: string;
  emoji: string;
  description: string;
  backgroundClass: string;
}

export interface StreakSticker {
  id: string;
  days: number;
  title: string;
  emoji: string;
}

export const PET_WORLDS: PetWorldDefinition[] = [
  { id: 'default_room', title: 'Комната', emoji: '🛋️', description: 'Домашняя комната питомца', backgroundClass: 'from-sky-100 to-amber-50' },
  { id: 'theatre', title: 'Театр', emoji: '🎭', description: 'Награда за ежедневное задание', backgroundClass: 'from-rose-100 to-purple-200' },
  { id: 'amusement_park', title: 'Аттракционы', emoji: '🎡', description: 'Награда за ежедневное задание', backgroundClass: 'from-cyan-100 to-yellow-100' },
  { id: 'ice_rink', title: 'Каток', emoji: '⛸️', description: 'Награда за ежедневное задание', backgroundClass: 'from-sky-50 to-blue-200' },
  { id: 'opera', title: 'Опера', emoji: '🎼', description: 'Награда за ежедневное задание', backgroundClass: 'from-indigo-100 to-amber-100' },
  { id: 'sausage_fridge', title: 'Холодильник с сосисками', emoji: '🌭', description: 'Награда за ежедневное задание', backgroundClass: 'from-teal-50 to-orange-100' },
];

export const STREAK_STICKERS: StreakSticker[] = [
  { id: 'streak_3', days: 3, title: 'Три дня вместе', emoji: '🌟' },
  { id: 'streak_7', days: 7, title: 'Неделя слов', emoji: '🔥' },
  { id: 'streak_14', days: 14, title: 'Верный друг', emoji: '🏅' },
  { id: 'streak_30', days: 30, title: 'Легенда AnnWord', emoji: '🏆' },
];

export const getUnlockedWorlds = (pet: PetState): PetWorldId[] => Array.from(new Set(['default_room', ...(pet.unlockedWorldIds || [])] as PetWorldId[]));
export const getWorld = (id?: PetWorldId): PetWorldDefinition => PET_WORLDS.find(world => world.id === id) || PET_WORLDS[0];
export const getEarnedStickers = (pet: PetState): StreakSticker[] => STREAK_STICKERS.filter(sticker => (pet.dailyStreak || 0) >= sticker.days || (pet.earnedStickerIds || []).includes(sticker.id));

export const getLevelAvailableAccessories = (level: number): ShopItem[] => getShopItemsByType('accessory').filter(item => item.minLevel <= level);
export const removeAccessoriesWhenMoodDrops = (pet: PetState): PetState => (
  (pet.moodScore ?? 0) < 34 ? { ...pet, equippedAccessories: [] } : pet
);

export const getRequestedTreat = (profile: UserProfile): ShopItem | null => {
  const treats = getShopItemsByType('food').filter(item => item.price > profile.coins).sort((a, b) => a.price - b.price);
  return treats[0] || getShopItemsByType('food').sort((a, b) => b.price - a.price)[0] || null;
};
