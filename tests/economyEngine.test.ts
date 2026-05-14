import { describe, expect, it } from 'vitest';
import {
  applyItemUseLocally,
  applyPurchaseLocally,
  canPurchaseItem,
  getInventoryQuantity,
  getPurchaseErrorMessage,
} from '../services/economyEngine';
import { ShopItem, UserProfile } from '../types';

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  username: 'Tester',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Owl',
    type: 'Owl',
    level: 2,
    mood: 'neutral',
    xp: 0,
    hunger: 40,
    energy: 50,
    equippedAccessories: [],
  },
  coins: 100,
  inventory: [],
  ...overrides,
});

const makeItem = (overrides: Partial<ShopItem> = {}): ShopItem => ({
  id: 'apple',
  name: 'Apple',
  price: 10,
  type: 'food',
  minLevel: 1,
  description: 'Food',
  imageUrl: 'apple.png',
  ...overrides,
});

describe('economyEngine', () => {
  it('allows valid purchases and rejects locked, invalid, unaffordable, and already-owned items', () => {
    expect(canPurchaseItem(makeProfile(), makeItem()).ok).toBe(true);
    expect(canPurchaseItem(makeProfile({ coins: 1 }), makeItem()).reason).toBe('insufficient_funds');
    expect(canPurchaseItem(makeProfile({ pet: { ...makeProfile().pet, level: 1 } }), makeItem({ minLevel: 3 })).reason).toBe('locked');
    expect(canPurchaseItem(makeProfile(), makeItem({ id: '', price: -1 })).reason).toBe('invalid_item');
    expect(canPurchaseItem(
      makeProfile({ inventory: [{ id: 'hat', type: 'accessory', name: 'Hat', quantity: 1 }] }),
      makeItem({ id: 'hat', name: 'Hat', type: 'accessory', price: 25 }),
    ).reason).toBe('already_owned');
  });

  it('adds food quantity and subtracts coins on purchase', () => {
    const profile = makeProfile({ inventory: [{ id: 'apple', type: 'food', name: 'Apple', quantity: 1 }] });
    const result = applyPurchaseLocally(profile, makeItem({ price: 15 }));

    expect(result.ok).toBe(true);
    expect(result.profile?.coins).toBe(85);
    expect(getInventoryQuantity(result.profile?.inventory || [], 'apple')).toBe(2);
    expect(profile.coins).toBe(100);
    expect(getInventoryQuantity(profile.inventory, 'apple')).toBe(1);
  });

  it('rejects duplicate non-food purchases without mutating profile or subtracting coins', () => {
    const profile = makeProfile({ inventory: [{ id: 'hat', type: 'accessory', name: 'Hat', quantity: 1 }] });
    const result = applyPurchaseLocally(profile, makeItem({ id: 'hat', name: 'Hat', type: 'accessory', price: 25 }));

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_owned');
    expect(result.profile).toBeUndefined();
    expect(profile.coins).toBe(100);
    expect(profile.inventory.filter(item => item.id === 'hat')).toHaveLength(1);
  });

  it('uses food by increasing hunger, setting happy mood, and consuming quantity', () => {
    const profile = makeProfile({ inventory: [{ id: 'apple', type: 'food', name: 'Apple', quantity: 1 }] });
    const result = applyItemUseLocally(profile, 'apple');

    expect(result.ok).toBe(true);
    expect(result.profile?.pet.hunger).toBe(60);
    expect(result.profile?.pet.mood).toBe('happy');
    expect(result.profile?.inventory).toEqual([]);
  });

  it('toggles accessories and switches pet type', () => {
    const profile = makeProfile({
      inventory: [
        { id: 'hat', type: 'accessory', name: 'Hat', quantity: 1 },
        { id: 'cat', type: 'pet', name: 'Cat', quantity: 1 },
      ],
    });

    const equipped = applyItemUseLocally(profile, 'hat').profile!;
    expect(equipped.pet.equippedAccessories).toContain('hat');

    const unequipped = applyItemUseLocally(equipped, 'hat').profile!;
    expect(unequipped.pet.equippedAccessories).not.toContain('hat');

    const switched = applyItemUseLocally(profile, 'cat').profile!;
    expect(switched.pet.type).toBe('Cat');
    expect(switched.pet.name).toBe('Cat');
    expect(switched.pet.mood).toBe('excited');
  });

  it('returns stable user-facing purchase error messages', () => {
    expect(getPurchaseErrorMessage('locked')).toContain('недоступен');
    expect(getPurchaseErrorMessage('insufficient_funds')).toContain('Недостаточно');
    expect(getPurchaseErrorMessage('invalid_item')).toContain('Предмет');
    expect(getPurchaseErrorMessage('already_owned')).toContain('уже есть');
    expect(getPurchaseErrorMessage()).toContain('не удалась');
  });
});
