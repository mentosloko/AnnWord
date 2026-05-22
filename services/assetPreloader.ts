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

const addPreloadHint = (url: string) => {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`link[rel="preload"][href="${url}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  document.head.appendChild(link);
};

export const preloadImageUrls = (urls: string[], priority: 'high' | 'low' = 'low') => {
  if (typeof window === 'undefined') return;

  urls.forEach(url => {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);

    if (priority === 'high') addPreloadHint(url);

    const image = new Image();
    image.decoding = 'async';
    image.loading = priority === 'high' ? 'eager' : 'lazy';
    if ('fetchPriority' in image) {
      (image as HTMLImageElement & { fetchPriority?: 'high' | 'low' | 'auto' }).fetchPriority = priority;
    }
    image.src = url;
  });
};

const scheduleDeferredPreload = (urls: string[]) => {
  if (typeof window === 'undefined' || urls.length === 0) return;

  const run = () => {
    urls.forEach((url, index) => {
      window.setTimeout(() => preloadImageUrls([url], 'low'), index * 80);
    });
  };

  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback?.(run, { timeout: 1800 });
    return;
  }

  window.setTimeout(run, 900);
};

export const preloadAppAssetsForProfile = (profile: UserProfile) => {
  preloadImageUrls(getCriticalAppPreloadImageUrls(profile), 'high');
  scheduleDeferredPreload(getDeferredAppPreloadImageUrls(profile));
};
