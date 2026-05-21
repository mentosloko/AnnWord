import { InventoryItem, PetState, ShopItem } from '../types';

const ACCESSORY_IDS = ['bow', 'glasses', 'hat', 'hero_cape', 'star_collar', 'crown'] as const;
const ACCESSORY_ORDER = [...ACCESSORY_IDS];
const PET_ASSET_SLUGS: Record<string, string> = {
  Puppy: 'puppy',
  Dragon: 'dragon',
  RoboCat: 'robocat',
};

const getPetAssetSlug = (petType?: string): string | null => {
  if (!petType) return null;
  return PET_ASSET_SLUGS[petType] || null;
};

const getPetBaseAssetUrl = (petType?: string): string | null => {
  const slug = getPetAssetSlug(petType);
  return slug ? `/assets/pets/${slug}/base/idle.png` : null;
};

const getPetRenderedBasePath = (petType?: string): string | null => {
  const slug = getPetAssetSlug(petType);
  return slug ? `/assets/pets/${slug}/rendered` : null;
};

const getPetAccessoryBasePath = (petType?: string): string | null => {
  const slug = getPetAssetSlug(petType);
  return slug ? `/assets/pets/${slug}/accessories` : null;
};

const getAccessoryKey = (accessories: string[]): string =>
  ACCESSORY_ORDER.filter(accessoryId => accessories.includes(accessoryId)).join('_');

export const MAX_EQUIPPED_ACCESSORIES = 2;

export const getPetAccessoryAssetUrl = (itemId: string, petType: string = 'Puppy'): string | null => {
  if (!ACCESSORY_IDS.includes(itemId as typeof ACCESSORY_IDS[number])) return null;

  const basePath = getPetAccessoryBasePath(petType);
  if (!basePath) return null;

  return `${basePath}/${itemId}.png`;
};

export const getPuppyAccessoryAssetUrl = (itemId: string): string | null =>
  getPetAccessoryAssetUrl(itemId, 'Puppy');

export const getPetCharacterAssetUrl = (pet: PetState): string | null => {
  const renderedBasePath = getPetRenderedBasePath(pet.type);
  const baseAssetUrl = getPetBaseAssetUrl(pet.type);

  if (!renderedBasePath || !baseAssetUrl) return null;

  const equippedAccessories = (pet.equippedAccessories || []).filter(accessoryId =>
    ACCESSORY_IDS.includes(accessoryId as typeof ACCESSORY_IDS[number]),
  );

  if (equippedAccessories.length === 0) return baseAssetUrl;

  const key = getAccessoryKey(equippedAccessories);
  return key ? `${renderedBasePath}/${key}.png` : baseAssetUrl;
};

export const getPuppyCharacterAssetUrl = (pet: PetState): string | null => {
  if (pet.type !== 'Puppy') return null;
  return getPetCharacterAssetUrl(pet);
};

export const getShopImageUrl = (item: ShopItem, petType: string = 'Puppy'): string | undefined => {
  if (item.type === 'accessory') return getPetAccessoryAssetUrl(item.id, petType) || item.imageUrl;
  return item.imageUrl;
};

export const getInventoryImageUrl = (item: InventoryItem, pet?: PetState): string | null => {
  if (item.type === 'accessory') return getPetAccessoryAssetUrl(item.id, pet?.type || 'Puppy');
  return item.metadata?.imageUrl || null;
};