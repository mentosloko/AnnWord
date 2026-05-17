import { describe, expect, it } from 'vitest';
import { mapProfileFromDB, normalizeDictionaryField, normalizeInventory, normalizePet, normalizeStats } from '../services/profileMapper';

describe('profileMapper', () => {
  it('normalizes dictionary fields with dictionary engine rules', () => {
    expect(normalizeDictionaryField([' apple ', 'APPLE', 'fox!', 123, 'мир'])).toEqual(['APPLE', 'FOX']);
    expect(normalizeDictionaryField('not-array')).toEqual([]);
  });

  it('normalizes stats and drops invalid guessed-word counters', () => {
    expect(normalizeStats({ gamesPlayed: 3, gamesWon: 2, wordsGuessed: { APPLE: 1, BAD: 'x' } })).toEqual({
      gamesPlayed: 3,
      gamesWon: 2,
      wordsGuessed: { APPLE: 1 },
    });
    expect(normalizeStats(null)).toEqual({ gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} });
  });

  it('normalizes character fields and falls back for invalid values', () => {
    const normalized = normalizePet({
      name: 'Kitty',
      type: 'Cat',
      level: 3,
      mood: 'broken',
      xp: 10,
      moodScore: 60,
      hunger: 50,
      energy: 40,
      stage: 'stage_1',
      equippedAccessories: [' hat ', 'hat', 1],
    });

    expect(normalized).toMatchObject({
      name: 'Kitty',
      type: 'Cat',
      level: 1,
      mood: 'happy',
      xp: 10,
      moodScore: 60,
      hunger: 50,
      energy: 40,
    });

    expect(normalized.equippedAccessories).toEqual(['hat']);
  });

  it('normalizes inventory and removes unusable entries', () => {
    const inventory = normalizeInventory([
      { id: 'apple', type: 'food', name: 'Apple', quantity: 2, metadata: { imageUrl: 'x.png' } },
      { id: 'bad', type: 'food', name: 'Bad', quantity: 0 },
      { id: '', type: 'pet', name: 'Empty', quantity: 1 },
      { id: 'mystery', type: 'unknown', name: 'Mystery', quantity: 1 },
    ]);

    expect(inventory).toEqual([
      { id: 'apple', type: 'food', name: 'Apple', quantity: 2, metadata: { imageUrl: 'x.png' } },
      { id: 'mystery', type: 'food', name: 'Mystery', quantity: 1, metadata: undefined },
    ]);
  });

  it('maps incomplete database profile to a safe user profile', () => {
    const profile = mapProfileFromDB({
      username: '  ',
      role: 'admin',
      custom_dictionary_en: ['stone', 'STONE'],
      stats: { gamesPlayed: 5, gamesWon: 4, wordsGuessed: { STONE: 2 } },
      pet: { type: 'Dragon', moodScore: 80 },
      coins: 42,
      inventory: [{ id: 'hat', type: 'accessory', name: 'Hat', quantity: 1 }],
    });

    expect(profile.username).toBe('Guest');
    expect(profile.role).toBe('admin');
    expect(profile.customDictionaryEn).toEqual(['STONE']);
    expect(profile.stats.gamesPlayed).toBe(5);
    expect(profile.pet.type).toBe('Dragon');
    expect(profile.pet.name).toBe('Щенок');
    expect(profile.coins).toBe(42);
    expect(profile.inventory).toHaveLength(1);
  });
});