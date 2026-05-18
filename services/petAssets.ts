import { InventoryItem, PetState, ShopItem } from '../types';

const PUPPY_ACCESSORY_ASSET_URLS: Record<string, string> = {
  bow: '/assets/pets/puppy/accessories/bow.svg',
  glasses: '/assets/pets/puppy/accessories/glasses.svg',
  hat: '/assets/pets/puppy/accessories/hat.svg',
  hero_cape: '/assets/pets/puppy/accessories/hero_cape.svg',
  star_collar: '/assets/pets/puppy/accessories/star_collar.svg',
};

export const getPuppyAccessoryAssetUrl = (itemId: string): string | null =>
  PUPPY_ACCESSORY_ASSET_URLS[itemId] || null;

export const getShopImageUrl = (item: ShopItem): string | undefined => {
  if (item.type === 'accessory') return getPuppyAccessoryAssetUrl(item.id) || item.imageUrl;
  return item.imageUrl;
};

export const getInventoryImageUrl = (item: InventoryItem, pet?: PetState): string | null => {
  if (item.type === 'accessory' && (!pet || pet.type === 'Puppy')) return getPuppyAccessoryAssetUrl(item.id);
  return item.metadata?.imageUrl || null;
};

export const getEquippedAccessoryAssetUrl = (pet: PetState, itemId: string): string | null => {
  if (pet.type !== 'Puppy') return null;
  return getPuppyAccessoryAssetUrl(itemId);
};

export const getPuppyAccessoryOverlayClass = (itemId: string): string => {
  switch (itemId) {
    case 'hero_cape': return 'absolute inset-0 z-0 scale-[1.35] translate-y-8 opacity-95';
    case 'star_collar': return 'absolute inset-0 z-30 scale-[0.82] translate-y-16';
    case 'glasses': return 'absolute inset-0 z-40 scale-[0.56] -translate-y-4';
    case 'hat': return 'absolute inset-0 z-50 scale-[0.55] -translate-y-20';
    case 'bow': return 'absolute inset-0 z-50 scale-[0.42] translate-x-12 -translate-y-20 rotate-12';
    default: return 'absolute inset-0 z-40 scale-[0.55]';
  }
};