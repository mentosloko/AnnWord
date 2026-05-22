import { UserProfile } from '../types';
import { SHOP_ITEMS } from './shopCatalog';
import { getPetCharacterAssetUrl, getPuppyCharacterPreloadUrls, getShopImageUrl } from './petAssets';

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

const uniqueUrls = (urls: Array<string | null | undefined>): string[] =>
  Array.from(new Set(urls.filter((url): url is string => Boolean(url))));

export const getCriticalAppPreloadImageUrls = (profile: UserProfile): string[] => {
  const petType = profile.pet.type || 'Puppy';
  return uniqueUrls([
    getPetCharacterAssetUrl(profile.pet),
    ROOM_BACKGROUND_BY_PET_TYPE[petType],
  ]);
};

export const getDeferredAppPreloadImageUrls = (profile: UserProfile): string[] => {
  const petType = profile.pet.type || 'Puppy';
  const criticalUrls = new Set(getCriticalAppPreloadImageUrls(profile));
  const characterUrls = petType === 'Puppy' ? getPuppyCharacterPreloadUrls() : [];
  const shopUrls = getVisibleShopAssetUrls(petType);

  return uniqueUrls([
    ...characterUrls,
    ...shopUrls,
  ]).filter(url => !criticalUrls.has(url));
};

export const getAppPreloadImageUrls = (profile: UserProfile): string[] =>
  uniqueUrls([
    ...getCriticalAppPreloadImageUrls(profile),
    ...getDeferredAppPreloadImageUrls(profile),
  ]);

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

const scheduleDeferredPreload = (urls: string[]) => {
  if (typeof window === 'undefined' || urls.length === 0) return;

  window.setTimeout(() => {
    urls.forEach((url, index) => {
      window.setTimeout(() => preloadImageUrls([url]), index * 100);
    });
  }, 1200);
};

export const preloadAppAssetsForProfile = (profile: UserProfile) => {
  preloadImageUrls(getCriticalAppPreloadImageUrls(profile));
  scheduleDeferredPreload(getDeferredAppPreloadImageUrls(profile));
};
