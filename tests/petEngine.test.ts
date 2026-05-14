import { describe, expect, it } from 'vitest';
import {
  applyPetDecay,
  derivePetMood,
  getInventoryEmoji,
  getPetEmoji,
  getPetNeedSnapshot,
  getVisibleInventory,
} from '../services/petEngine';
import { PetState, UserProfile } from '../types';

const pet: PetState = {
  name: 'Owl',
  type: 'Owl',
  level: 1,
  mood: 'neutral',
  xp: 0,
  hunger: 100,
  energy: 100,
  equippedAccessories: [],
};

const profile: UserProfile = {
  username: 'Tester',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet,
  coins: 0,
  inventory: [
    { id: 'apple', type: 'food', name: 'Apple', quantity: 2 },
    { id: 'hat', type: 'accessory', name: 'Hat', quantity: 1 },
    { id: 'empty', type: 'food', name: 'Empty', quantity: 0 },
  ],
};

describe('petEngine', () => {
  it('derives mood from hunger and energy thresholds', () => {
    expect(derivePetMood(10, 90)).toBe('sad');
    expect(derivePetMood(90, 10)).toBe('sad');
    expect(derivePetMood(40, 80)).toBe('neutral');
    expect(derivePetMood(90, 90)).toBe('excited');
    expect(derivePetMood(70, 70)).toBe('happy');
  });

  it('returns need snapshots with clamped values and attention levels', () => {
    expect(getPetNeedSnapshot({ ...pet, hunger: 10, energy: 100 })).toMatchObject({ attentionLevel: 'critical', statusLabel: 'Нужна забота' });
    expect(getPetNeedSnapshot({ ...pet, hunger: 50, energy: 100 })).toMatchObject({ attentionLevel: 'watch', statusLabel: 'Стоит покормить' });
    expect(getPetNeedSnapshot({ ...pet, hunger: 150, energy: 150 })).toMatchObject({ hunger: 100, energy: 100, attentionLevel: 'ok' });
  });

  it('applies deterministic time-based decay without mutating original pet', () => {
    const decayed = applyPetDecay({ ...pet, hunger: 100, energy: 100 }, {
      nowMs: 1000 * 60 * 60 * 5,
      lastActiveMs: 0,
      hungerLossPerHour: 10,
      energyLossPerHour: 5,
    });

    expect(decayed.hunger).toBe(50);
    expect(decayed.energy).toBe(75);
    expect(decayed.mood).toBe('neutral');
    expect(pet.hunger).toBe(100);
  });

  it('maps known inventory and pet emojis with fallbacks', () => {
    expect(getInventoryEmoji({ id: 'apple', type: 'food', name: 'Apple', quantity: 1 })).toBe('🍎');
    expect(getInventoryEmoji({ id: 'unknown', type: 'food', name: 'Unknown', quantity: 1 })).toBe('🎁');
    expect(getPetEmoji({ ...pet, type: 'Owl' })).toBe('🦉');
    expect(getPetEmoji({ ...pet, type: 'Cat' })).toBe('🐱');
    expect(getPetEmoji({ ...pet, type: 'Dragon' })).toBe('🐲');
    expect(getPetEmoji({ ...pet, type: 'Unknown' })).toBe('🐾');
  });

  it('filters visible inventory by type and positive quantity', () => {
    expect(getVisibleInventory(profile, 'food').map(item => item.id)).toEqual(['apple']);
    expect(getVisibleInventory(profile, 'accessory').map(item => item.id)).toEqual(['hat']);
  });
});
