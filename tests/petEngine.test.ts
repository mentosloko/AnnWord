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
  name: 'Бадди',
  type: 'Puppy',
  level: 1,
  mood: 'happy',
  xp: 0,
  moodScore: 60,
  stage: 'stage_1',
  characterOnboarded: true,
  hunger: 60,
  energy: 60,
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
    { id: 'dog_house', type: 'home', name: 'Будка', quantity: 1 },
    { id: 'empty', type: 'food', name: 'Empty', quantity: 0 },
  ],
};

describe('petEngine', () => {
  it('derives mood from mood score thresholds and keeps legacy two-arg compatibility', () => {
    expect(derivePetMood(10)).toBe('sad');
    expect(derivePetMood(40)).toBe('calm');
    expect(derivePetMood(60)).toBe('happy');
    expect(derivePetMood(80)).toBe('joyful');
    expect(derivePetMood(95)).toBe('super_happy');
    expect(derivePetMood(10, 90)).toBe('sad');
  });

  it('returns mood snapshots with clamped values and attention levels', () => {
    expect(getPetNeedSnapshot({ ...pet, moodScore: 10 })).toMatchObject({ attentionLevel: 'critical', statusLabel: 'Скучает' });
    expect(getPetNeedSnapshot({ ...pet, moodScore: 40 })).toMatchObject({ attentionLevel: 'watch', statusLabel: 'Спокойное настроение' });
    expect(getPetNeedSnapshot({ ...pet, moodScore: 150 })).toMatchObject({ moodScore: 100, hunger: 100, energy: 100, attentionLevel: 'ok' });
  });

  it('applies deterministic day-based mood decay without mutating original pet', () => {
    const decayed = applyPetDecay({ ...pet, moodScore: 60 }, {
      nowMs: 1000 * 60 * 60 * 24 * 2,
      lastActiveMs: 0,
      moodLossPerDay: 8,
    });

    expect(decayed.moodScore).toBe(44);
    expect(decayed.hunger).toBe(44);
    expect(decayed.energy).toBe(44);
    expect(decayed.mood).toBe('calm');
    expect(pet.moodScore).toBe(60);
  });

  it('maps known inventory and character emojis with fallbacks', () => {
    expect(getInventoryEmoji({ id: 'apple', type: 'food', name: 'Apple', quantity: 1 })).toBe('🍎');
    expect(getInventoryEmoji({ id: 'unknown', type: 'food', name: 'Unknown', quantity: 1 })).toBe('🎁');
    expect(getPetEmoji({ ...pet, type: 'Puppy' })).toBe('🐶');
    expect(getPetEmoji({ ...pet, type: 'Cat' })).toBe('🐱');
    expect(getPetEmoji({ ...pet, type: 'Dragon' })).toBe('🐲');
    expect(getPetEmoji({ ...pet, type: 'RoboCat' })).toBe('🤖');
    expect(getPetEmoji({ ...pet, type: 'Unknown' })).toBe('🐾');
  });

  it('filters visible inventory by type and positive quantity', () => {
    expect(getVisibleInventory(profile, 'food').map(item => item.id)).toEqual(['apple']);
    expect(getVisibleInventory(profile, 'accessory').map(item => item.id)).toEqual(['hat']);
    expect(getVisibleInventory(profile, 'home').map(item => item.id)).toEqual(['dog_house']);
  });
});
