import { InventoryItem, PetState, UserProfile, UserStats } from '../types';
import { normalizeCustomDictionary } from './dictionaryEngine';

const DEFAULT_PET: PetState = {
  name: 'Owl',
  type: 'Owl',
  level: 1,
  mood: 'happy',
  xp: 0,
  hunger: 100,
  energy: 100,
  equippedAccessories: []
};

const DEFAULT_STATS: UserStats = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().toUpperCase().replace(/[^A-Z]/g, ''))
        .filter(Boolean)
    )
  );
};

export const normalizeDictionaryField = (value: unknown): string[] =>
  Array.isArray(value) ? normalizeCustomDictionary(value.filter((item): item is string => typeof item === 'string')) : [];

export const normalizeStats = (value: unknown): UserStats => {
  if (!isPlainObject(value)) return { ...DEFAULT_STATS };

  const wordsGuessed = isPlainObject(value.wordsGuessed) ? value.wordsGuessed : {};

  return {
    gamesPlayed: typeof value.gamesPlayed === 'number' ? value.gamesPlayed : 0,
    gamesWon: typeof value.gamesWon === 'number' ? value.gamesWon : 0,
    wordsGuessed: Object.fromEntries(
      Object.entries(wordsGuessed).filter((entry): entry is [string, number] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'number'
      )
    )
  };
};

export const normalizePet = (value: unknown): PetState => {
  if (!isPlainObject(value)) return { ...DEFAULT_PET };

  return {
    ...DEFAULT_PET,
    ...value,
    name: typeof value.name === 'string' ? value.name : DEFAULT_PET.name,
    type: typeof value.type === 'string' ? value.type : DEFAULT_PET.type,
    level: typeof value.level === 'number' ? value.level : DEFAULT_PET.level,
    mood: ['sad', 'neutral', 'happy', 'excited'].includes(String(value.mood))
      ? value.mood as PetState['mood']
      : DEFAULT_PET.mood,
    xp: typeof value.xp === 'number' ? value.xp : DEFAULT_PET.xp,
    hunger: typeof value.hunger === 'number' ? value.hunger : DEFAULT_PET.hunger,
    energy: typeof value.energy === 'number' ? value.energy : DEFAULT_PET.energy,
    equippedAccessories: normalizeStringArray(value.equippedAccessories)
  };
};

export const normalizeInventory = (value: unknown): InventoryItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainObject)
    .map(item => ({
      id: typeof item.id === 'string' ? item.id : '',
      type: ['food', 'pet', 'accessory'].includes(String(item.type))
        ? item.type as InventoryItem['type']
        : 'food',
      name: typeof item.name === 'string' ? item.name : '',
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      metadata: isPlainObject(item.metadata) ? { imageUrl: String(item.metadata.imageUrl || '') } : undefined
    }))
    .filter(item => item.id && item.name && item.quantity > 0);
};

export const mapProfileFromDB = (data: any): UserProfile => ({
  username: typeof data?.username === 'string' && data.username.trim() ? data.username : 'Guest',
  role: data?.role === 'admin' ? 'admin' : 'user',
  customDictionaryEn: normalizeDictionaryField(data?.custom_dictionary_en),
  stats: normalizeStats(data?.stats),
  pet: normalizePet(data?.pet),
  coins: typeof data?.coins === 'number' ? data.coins : 0,
  inventory: normalizeInventory(data?.inventory)
});
