import { UserProfile } from '../types';
import { SHOP_ITEMS } from './shopCatalog';
import { getPuppyCharacterPreloadUrls, getShopImageUrl } from './petAssets';

const preloadedUrls = new Set<string>();

const ROOM_BACKGROUND_BY_PET_TYPE: Record<string, string> = {
  Puppy: '/assets/rooms/puppy/background.webp',
};

const getVisibleShopAssetUrls = (petType: string): string[] =>
  SHOP_ITEMS
    .filter(item => item.type !== 'home')
    .filter(item => !item.characterType || item.characterType === petType)
    .map(item => getShopImageUrl(item, petType) || item.imageUrl)
    .filter((url): url is string => Boolean(url));

export const getAppPreloadImageUrls = (profile: UserProfile): string[] => {
  const petType = profile.pet.type || 'Puppy';
  const roomBackgroundUrl = ROOM_BACKGROUND_BY_PET_TYPE[petType];
  const characterUrls = petType === 'Puppy' ? getPuppyCharacterPreloadUrls() : [];
  const shopUrls = getVisibleShopAssetUrls(petType);

  return Array.from(new Set([
    roomBackgroundUrl,
    ...characterUrls,
    ...shopUrls,
  ].filter((url): url is string => Boolean(url))));
};

export const preloadImageUrls = (urls: string[]) => {
  if (typeof window === 'undefined') return;

  urls.forEach(url => {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);

    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = url;
  });
};

export const preloadAppAssetsForProfile = (profile: UserProfile) => {
  preloadImageUrls(getAppPreloadImageUrls(profile));
};
