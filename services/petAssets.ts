import { InventoryItem, PetState, ShopItem } from '../types';

const PUPPY_BASE_ASSET_URL = '/assets/pets/puppy/base/idle.png';
const PUPPY_ACCESSORY_STATE_BASE_PATH = '/assets/pets/puppy/with-accessories';

const PUPPY_ACCESSORY_ASSET_URLS: Record<string, string> = {
  bow: '/assets/pets/puppy/accessories/bow.png',
  glasses: '/assets/pets/puppy/accessories/glasses.png',
  hat: '/assets/pets/puppy/accessories/hat.png',
  hero_cape: '/assets/pets/puppy/accessories/hero_cape.png',
  star_collar: '/assets/pets/puppy/accessories/star_collar.png',
  crown: '/assets/pets/puppy/accessories/crown.png',
};

const PUPPY_COMBO_ASSETS: Array<{ key: string; accessories: string[]; url: string }> = [
  { key: 'bow_glasses', accessories: ['bow', 'glasses'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/bow_glasses.png` },
  { key: 'bow_hat', accessories: ['bow', 'hat'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/bow_hat.png` },
  { key: 'bow_hero_cape', accessories: ['bow', 'hero_cape'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/bow_hero_cape.png` },
  { key: 'bow_star_collar', accessories: ['bow', 'star_collar'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/bow_star_collar.png` },
  { key: 'bow_crown', accessories: ['bow', 'crown'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/bow_crown.png` },
  { key: 'glasses_hat', accessories: ['glasses', 'hat'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/glasses_hat.png` },
  { key: 'glasses_hero_cape', accessories: ['glasses', 'hero_cape'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/glasses_hero_cape.png` },
  { key: 'glasses_star_collar', accessories: ['glasses', 'star_collar'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/glasses_star_collar.png` },
  { key: 'glasses_crown', accessories: ['glasses', 'crown'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/glasses_crown.png` },
  { key: 'hat_hero_cape', accessories: ['hat', 'hero_cape'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hat_hero_cape.png` },
  { key: 'hat_star_collar', accessories: ['hat', 'star_collar'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hat_star_collar.png` },
  { key: 'hat_crown', accessories: ['hat', 'crown'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hat_crown.png` },
  { key: 'hero_cape_star_collar', accessories: ['hero_cape', 'star_collar'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hero_cape_star_collar.png` },
  { key: 'hero_cape_crown', accessories: ['hero_cape', 'crown'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hero_cape_crown.png` },
  { key: 'star_collar_crown', accessories: ['star_collar', 'crown'], url: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/star_collar_crown.png` },
];

const PUPPY_SINGLE_ASSET_URLS: Record<string, string> = {
  bow: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/bow.png`,
  glasses: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/glasses.png`,
  hat: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hat.png`,
  hero_cape: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/hero_cape.png`,
  star_collar: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/star_collar.png`,
  crown: `${PUPPY_ACCESSORY_STATE_BASE_PATH}/crown.png`,
};

export const MAX_EQUIPPED_ACCESSORIES = 2;

export const getPuppyAccessoryAssetUrl = (itemId: string): string | null =>
  PUPPY_ACCESSORY_ASSET_URLS[itemId] || null;

export const getPuppyCharacterAssetUrl = (pet: PetState): string | null => {
  if (pet.type !== 'Puppy') return null;

  const equippedAccessories = pet.equippedAccessories || [];
  if (equippedAccessories.length === 1) {
    return PUPPY_SINGLE_ASSET_URLS[equippedAccessories[0]] || PUPPY_BASE_ASSET_URL;
  }

  const equipped = new Set(equippedAccessories);
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