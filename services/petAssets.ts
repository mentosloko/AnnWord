import { InventoryItem, PetState, ShopItem } from '../types';
import { assetUrl } from './assetUrl';

const ACCESSORY_IDS = ['bow', 'glasses', 'hat', 'hero_cape', 'star_collar', 'crown'] as const;
const ACCESSORY_ORDER = [...ACCESSORY_IDS];
const PET_ASSET_SLUGS: Record<string, string> = {
  Puppy: 'puppy',
  Dragon: 'dragon',
  RoboCat: 'robocat',
};
const MYSTERY_BOX_ASSET_URL = assetUrl('/assets/rewards/mystery-box.webp');

const getPetAssetSlug = (petType?: string): string | null => {
  if (!petType) return null;
  return PET_ASSET_SLUGS[petType] || null;
};

const getPetCharacterExtension = (petType?: string): 'png' | 'webp' =>
  petType === 'Puppy' ? 'webp' : 'png';

const getPetBaseAssetUrl = (petType?: string): string | null => {
  const slug = getPetAssetSlug(petType);
  if (!slug) return null;
  return assetUrl(`/assets/pets/${slug}/base/idle.${getPetCharacterExtension(petType)}`);
};

const getPetRenderedBasePath = (petType?: string): string | null => {
  const slug = getPetAssetSlug(petType);
  if (!slug) return null;

  const renderedFolder = petType === 'Puppy' ? 'with-accessories' : 'rendered';
  return assetUrl(`/assets/pets/${slug}/${renderedFolder}`);
};

const getPetAccessoryBasePath = (petType?: string): string | null => {
  const slug = getPetAssetSlug(petType);
  return slug ? assetUrl(`/assets/pets/${slug}/accessories`) : null;
};

const getAccessoryKey = (accessories: string[]): string =>
  ACCESSORY_ORDER.filter(accessoryId => accessories.includes(accessoryId)).join('_');

const getAccessoryPairKeys = (): string[] => {
  const pairKeys: string[] = [];
  ACCESSORY_ORDER.forEach((firstAccessory, firstIndex) => {
    ACCESSORY_ORDER.slice(firstIndex + 1).forEach(secondAccessory => {
      pairKeys.push(`${firstAccessory}_${secondAccessory}`);
    });
  });
  return pairKeys;
};

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
  return key ? `${renderedBasePath}/${key}.${getPetCharacterExtension(pet.type)}` : baseAssetUrl;
};

export const getPuppyCharacterAssetUrl = (pet: PetState): string | null => {
  if (pet.type !== 'Puppy') return null;
  return getPetCharacterAssetUrl(pet);
};

export const getPuppyCharacterPreloadUrls = (): string[] => {
  const baseAssetUrl = getPetBaseAssetUrl('Puppy');
  const renderedBasePath = getPetRenderedBasePath('Puppy');
  if (!baseAssetUrl || !renderedBasePath) return [];

  const extension = getPetCharacterExtension('Puppy');
  const singleAccessoryUrls = ACCESSORY_ORDER.map(accessoryId => `${renderedBasePath}/${accessoryId}.${extension}`);
  const pairAccessoryUrls = getAccessoryPairKeys().map(pairKey => `${renderedBasePath}/${pairKey}.${extension}`);

  return [baseAssetUrl, ...singleAccessoryUrls, ...pairAccessoryUrls];
};

export const getShopImageUrl = (item: ShopItem, petType: string = 'Puppy'): string | undefined => {
  if (item.id === 'mystery_box') return MYSTERY_BOX_ASSET_URL;
  if (item.type === 'accessory') return getPetAccessoryAssetUrl(item.id, petType) || (item.imageUrl ? assetUrl(item.imageUrl) : undefined);
  return item.imageUrl ? assetUrl(item.imageUrl) : undefined;
};

export const getInventoryImageUrl = (item: InventoryItem, pet?: PetState): string | null => {
  if (item.id === 'mystery_box') return MYSTERY_BOX_ASSET_URL;
  if (item.type === 'accessory') return getPetAccessoryAssetUrl(item.id, pet?.type || 'Puppy');
  return item.metadata?.imageUrl ? assetUrl(item.metadata.imageUrl) : null;
};