import { InventoryItem, PetState, ShopItem, UserProfile } from '../types';
import { applyTreatMood } from './gamificationRules';
import { getShopItemById } from './shopCatalog';

export interface PurchaseResult {
  ok: boolean;
  reason?: 'not_authenticated' | 'locked' | 'insufficient_funds' | 'invalid_item' | 'already_owned';
  profile?: UserProfile;
  awardedItem?: ShopItem;
}

const pickWeightedReward = (item: ShopItem, random: () => number = Math.random): ShopItem | null => {
  const pool = item.randomReward?.pool || [];
  const validPool = pool
    .map(option => ({ ...option, item: getShopItemById(option.itemId) }))
    .filter((option): option is typeof option & { item: ShopItem } => Boolean(option.item) && option.weight > 0);

  const totalWeight = validPool.reduce((sum, option) => sum + option.weight, 0);
  if (totalWeight <= 0) return null;

  let cursor = random() * totalWeight;
  for (const option of validPool) {
    cursor -= option.weight;
    if (cursor <= 0) return option.item;
  }

  return validPool[validPool.length - 1]?.item || null;
};

const addInventoryItem = (inventory: InventoryItem[], item: ShopItem): InventoryItem[] => {
  const nextInventory = inventory.map(entry => ({ ...entry }));
  const existingIndex = nextInventory.findIndex(entry => entry.id === item.id);

  if (existingIndex >= 0 && item.type === 'food') {
    nextInventory[existingIndex] = {
      ...nextInventory[existingIndex],
      quantity: nextInventory[existingIndex].quantity + 1,
    };
  } else if (existingIndex < 0) {
    nextInventory.push({
      id: item.id,
      type: item.type,
      name: item.name,
      quantity: 1,
      metadata: { imageUrl: item.imageUrl || '' },
    });
  }

  return nextInventory;
};

export const canPurchaseItem = (profile: UserProfile, item: ShopItem): PurchaseResult => {
  if (!item || !item.id || item.price < 0) return { ok: false, reason: 'invalid_item' };
  if ((profile.pet.level || 1) < item.minLevel) return { ok: false, reason: 'locked' };
  if (item.characterType && profile.pet.type !== item.characterType) return { ok: false, reason: 'locked' };
  if (profile.coins < item.price) return { ok: false, reason: 'insufficient_funds' };
  if (item.type !== 'food' && item.type !== 'mystery' && profile.inventory.some(entry => entry.id === item.id)) {
    return { ok: false, reason: 'already_owned' };
  }
  return { ok: true };
};

export const applyPurchaseLocally = (profile: UserProfile, item: ShopItem, random: () => number = Math.random): PurchaseResult => {
  const allowed = canPurchaseItem(profile, item);
  if (!allowed.ok) return allowed;

  let awardedItem: ShopItem | undefined;
  let inventory = profile.inventory.map(entry => ({ ...entry }));

  if (item.type === 'mystery') {
    const reward = pickWeightedReward(item, random);
    if (!reward) return { ok: false, reason: 'invalid_item' };
    awardedItem = reward;
    inventory = addInventoryItem(inventory, reward);
  } else {
    inventory = addInventoryItem(inventory, item);
  }

  return {
    ok: true,
    awardedItem,
    profile: {
      ...profile,
      coins: profile.coins - item.price,
      inventory,
    },
  };
};

export const applyItemUseLocally = (profile: UserProfile, itemId: string): PurchaseResult => {
  const inventory = profile.inventory.map(entry => ({ ...entry }));
  const index = inventory.findIndex(entry => entry.id === itemId);
  if (index < 0) return { ok: false, reason: 'invalid_item' };

  const item = inventory[index];
  const shopItem = getShopItemById(itemId);
  let pet: PetState = { ...profile.pet, equippedAccessories: [...(profile.pet.equippedAccessories || [])] };

  if (item.type === 'food') {
    const moodDelta = shopItem?.effect?.mood ?? 8;
    const moodCap = shopItem?.effect?.moodCap ?? 100;
    pet = applyTreatMood(pet, moodDelta, moodCap);
    pet.hunger = pet.moodScore;
    pet.energy = pet.moodScore;
    item.quantity -= 1;
    if (item.quantity <= 0) inventory.splice(index, 1);
  }

  if (item.type === 'pet') {
    pet.type = item.name;
    pet.name = item.name;
    pet.moodScore = 80;
    pet.mood = 'joyful';
  }

  if (item.type === 'accessory') {
    const equippedIndex = pet.equippedAccessories.indexOf(item.id);
    if (equippedIndex >= 0) pet.equippedAccessories.splice(equippedIndex, 1);
    else pet.equippedAccessories.push(item.id);
  }

  if (item.type === 'home') {
    pet.activeHomeItemId = pet.activeHomeItemId === item.id ? undefined : item.id;
  }

  return {
    ok: true,
    profile: {
      ...profile,
      pet,
      inventory,
    },
  };
};

export const getPurchaseErrorMessage = (reason?: PurchaseResult['reason']): string => {
  switch (reason) {
    case 'locked': return 'Предмет пока недоступен для этого уровня или персонажа.';
    case 'insufficient_funds': return 'Недостаточно монет.';
    case 'not_authenticated': return 'Для покупки нужно войти в аккаунт.';
    case 'invalid_item': return 'Предмет не найден или повреждён.';
    case 'already_owned': return 'Этот предмет уже есть в инвентаре.';
    default: return 'Покупка не удалась.';
  }
};

export const getInventoryQuantity = (inventory: InventoryItem[], itemId: string): number =>
  inventory.find(item => item.id === itemId)?.quantity || 0;