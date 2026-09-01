import { describe, expect, it } from 'vitest';
import type { ShopItem } from '../types';
import { getPetAccessoryAssetUrl, getShopImageUrl } from '../services/petAssets';

describe('pet asset delivery', () => {
  it('uses the compact SVG asset for puppy accessories', () => {
    expect(getPetAccessoryAssetUrl('bow')).toContain('/assets/pets/puppy/accessories/bow.svg');
  });

  it('uses the checked-in WebP derivative for treat icons', () => {
    const treat: ShopItem = {
      id: 'crunchik',
      name: 'Хрустик',
      price: 1,
      type: 'food',
      minLevel: 1,
      description: '',
      imageUrl: '/assets/items/treats/crunchik.png',
    };
    expect(getShopImageUrl(treat)).toContain('/assets/items/treats/crunchik.webp');
  });
});
