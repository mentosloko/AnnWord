import { InventoryItem, PetState, ShopItem } from '../types';

const PUPPY_BASE_ASSET_URL = '/assets/pets/puppy/base/idle.svg';

const PUPPY_ACCESSORY_ASSET_URLS: Record<string, string> = {
  bow: '/assets/pets/puppy/accessories/bow.svg',
  glasses: '/assets/pets/puppy/accessories/glasses.svg',
  hat: '/assets/pets/puppy/accessories/hat.svg',
  hero_cape: '/assets/pets/puppy/accessories/hero_cape.svg',
  star_collar: '/assets/pets/puppy/accessories/star_collar.svg',
};

const PUPPY_COMBO_ASSETS: Array<{ key: string; accessories: string[]; url: string }> = [
  { key: 'bow_glasses', accessories: ['bow', 'glasses'], url: '/assets/pets/puppy/with-accessories/bow_glasses.svg' },
  { key: 'bow_hat', accessories: ['bow', 'hat'], url: '/assets/pets/puppy/with-accessories/bow_hat.svg' },
  { key: 'bow_hero_cape', accessories: ['bow', 'hero_cape'], url: '/assets/pets/puppy/with-accessories/bow_hero_cape.svg' },
  { key: 'bow_star_collar', accessories: ['bow', 'star_collar'], url: '/assets/pets/puppy/with-accessories/bow_star_collar.svg' },
  { key: 'bow_crown', accessories: ['bow', 'crown'], url: '/assets/pets/puppy/with-accessories/bow_crown.svg' },
  { key: 'glasses_hat', accessories: ['glasses', 'hat'], url: '/assets/pets/puppy/with-accessories/glasses_hat.svg' },
  { key: 'glasses_hero_cape', accessories: ['glasses', 'hero_cape'], url: '/assets/pets/puppy/with-accessories/glasses_hero_cape.svg' },
  { key: 'glasses_star_collar', accessories: ['glasses', 'star_collar'], url: '/assets/pets/puppy/with-accessories/glasses_star_collar.svg' },
  { key: 'glasses_crown', accessories: ['glasses', 'crown'], url: '/assets/pets/puppy/with-accessories/glasses_crown.svg' },
  { key: 'hat_hero_cape', accessories: ['hat', 'hero_cape'], url: '/assets/pets/puppy/with-accessories/hat_hero_cape.svg' },
];

export const getPuppyAccessoryAssetUrl = (itemId: string): string | null =>
  PUPPY_ACCESSORY_ASSET_URLS[itemId] || null;

export const getPuppyCharacterAssetUrl = (pet: PetState): string | null => {
  if (pet.type !== 'Puppy') return null;

  const equipped = new Set(pet.equippedAccessories || []);
  const matchingCombo = PUPPY_COMBO_ASSETS.find(combo =>
    combo.accessories.every(accessoryId => equipped.has(accessoryId)),
  );

  return matchingCombo?.url || PUPPY_BASE_ASSET_URL;
};

export const getShopImageUrl = (item: ShopItem): string | undefined => {
  if (item.type === 'accessory') return getPuppyAccessoryAssetUrl(item.id) || item.imageUrl;
  return item.imageUrl;
};

export const getInventoryImageUrl = (item: InventoryItem, pet?: PetState): string | null => {
  if (item.type === 'accessory' && (!pet || pet.type === 'Puppy')) return getPuppyAccessoryAssetUrl(item.id);
  return item.metadata?.imageUrl || null;
};