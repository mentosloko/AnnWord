import { InventoryItem, PetState, ShopItem } from '../types';

const PUPPY_BASE_ASSET_URL = '/assets/pets/puppy/base/idle.svg';

const PUPPY_ACCESSORY_ASSET_URLS: Record<string, string> = {
  bow: '/assets/pets/puppy/accessories/bow.svg',
  glasses: '/assets/pets/puppy/accessories/glasses.svg',
  hat: '/assets/pets/puppy/accessories/hat.svg',
  hero_cape: '/assets/pets/puppy/accessories/hero_cape.svg',
  star_collar: '/assets/pets/puppy/accessories/star_collar.svg',
};

const PUPPY_COMBO_ASSET_URLS: Record<string, string> = {
  bow_glasses: '/assets/pets/puppy/with-accessories/bow_glasses.svg',
  bow_hat: '/assets/pets/puppy/with-accessories/bow_hat.svg',
  bow_hero_cape: '/assets/pets/puppy/with-accessories/bow_hero_cape.svg',
  bow_star_collar: '/assets/pets/puppy/with-accessories/bow_star_collar.svg',
  bow_crown: '/assets/pets/puppy/with-accessories/bow_crown.svg',
  glasses_hat: '/assets/pets/puppy/with-accessories/glasses_hat.svg',
  glasses_hero_cape: '/assets/pets/puppy/with-accessories/glasses_hero_cape.svg',
  glasses_star_collar: '/assets/pets/puppy/with-accessories/glasses_star_collar.svg',
  glasses_crown: '/assets/pets/puppy/with-accessories/glasses_crown.svg',
  hat_hero_cape: '/assets/pets/puppy/with-accessories/hat_hero_cape.svg',
};

const PUPPY_COMBO_PRIORITY = [
  'bow_glasses',
  'bow_hat',
  'bow_hero_cape',
  'bow_star_collar',
  'bow_crown',
  'glasses_hat',
  'glasses_hero_cape',
  'glasses_star_collar',
  'glasses_crown',
  'hat_hero_cape',
];

export const getPuppyAccessoryAssetUrl = (itemId: string): string | null =>
  PUPPY_ACCESSORY_ASSET_URLS[itemId] || null;

export const getPuppyCharacterAssetUrl = (pet: PetState): string | null => {
  if (pet.type !== 'Puppy') return null;

  const equipped = new Set(pet.equippedAccessories || []);
  const matchingCombo = PUPPY_COMBO_PRIORITY.find(comboKey =>
    comboKey.split('_').every(part => equipped.has(part === 'cape' ? 'hero_cape' : part)),
  );

  return matchingCombo ? PUPPY_COMBO_ASSET_URLS[matchingCombo] : PUPPY_BASE_ASSET_URL;
};

export const getShopImageUrl = (item: ShopItem): string | undefined => {
  if (item.type === 'accessory') return getPuppyAccessoryAssetUrl(item.id) || item.imageUrl;
  return item.imageUrl;
};

export const getInventoryImageUrl = (item: InventoryItem, pet?: PetState): string | null => {
  if (item.type === 'accessory' && (!pet || pet.type === 'Puppy')) return getPuppyAccessoryAssetUrl(item.id);
  return item.metadata?.imageUrl || null;
};