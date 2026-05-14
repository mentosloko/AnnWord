import { InventoryItem, PetState, ShopItem, UserProfile } from '../types';

export interface PurchaseResult {
  ok: boolean;
  reason?: 'not_authenticated' | 'locked' | 'insufficient_funds' | 'invalid_item';
  profile?: UserProfile;
}

export const canPurchaseItem = (profile: UserProfile, item: ShopItem): PurchaseResult => {
  if (!item || !item.id || item.price < 0) return { ok: false, reason: 'invalid_item' };
  if ((profile.pet.level || 1) < item.minLevel) return { ok: false, reason: 'locked' };
  if (profile.coins < item.price) return { ok: false, reason: 'insufficient_funds' };
  return { ok: true };
};

export const applyPurchaseLocally = (profile: UserProfile, item: ShopItem): PurchaseResult => {
  const allowed = canPurchaseItem(profile, item);
  if (!allowed.ok) return allowed;

  const inventory = profile.inventory.map(entry => ({ ...entry }));
  const existingIndex = inventory.findIndex(entry => entry.id === item.id);

  if (existingIndex >= 0 && item.type === 'food') {
    inventory[existingIndex] = {
      ...inventory[existingIndex],
      quantity: inventory[existingIndex].quantity + 1,
    };
  } else if (existingIndex < 0 || item.type !== 'food') {
    inventory.push({
      id: item.id,
      type: item.type,
      name: item.name,
      quantity: 1,
      metadata: { imageUrl: item.imageUrl || '' },
    });
  }

  return {
    ok: true,
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
  const pet: PetState = { ...profile.pet, equippedAccessories: [...(profile.pet.equippedAccessories || [])] };

  if (item.type === 'food') {
    pet.hunger = Math.min(100, (pet.hunger || 0) + 20);
    pet.mood = 'happy';
    item.quantity -= 1;
    if (item.quantity <= 0) inventory.splice(index, 1);
  }

  if (item.type === 'pet') {
    pet.type = item.name;
    pet.name = item.name;
    pet.mood = 'excited';
  }

  if (item.type === 'accessory') {
    const equippedIndex = pet.equippedAccessories.indexOf(item.id);
    if (equippedIndex >= 0) pet.equippedAccessories.splice(equippedIndex, 1);
    else pet.equippedAccessories.push(item.id);
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
    case 'locked': return 'Предмет пока недоступен: нужен более высокий уровень питомца.';
    case 'insufficient_funds': return 'Недостаточно монет.';
    case 'not_authenticated': return 'Для покупки нужно войти в аккаунт.';
    case 'invalid_item': return 'Предмет не найден или повреждён.';
    default: return 'Покупка не удалась.';
  }
};

export const getInventoryQuantity = (inventory: InventoryItem[], itemId: string): number =>
  inventory.find(item => item.id === itemId)?.quantity || 0;
