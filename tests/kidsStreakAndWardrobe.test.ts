import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapProfileFromDB } from '../services/profileMapper';

const source = (path: string): string => readFileSync(path, 'utf8');
const basePet = (equippedAccessories: string[], moodScore: number) => ({
  name: 'Щенок',
  type: 'Puppy',
  level: 1,
  mood: moodScore < 34 ? 'sad' : 'happy',
  moodScore,
  xp: 0,
  equippedAccessories,
});

describe('Kids streak placement', () => {
  it('keeps the streak prominently on Kids home and out of the global header and pet room', () => {
    const home = source('components/screens/KidsHomeScreen.tsx');
    const header = source('components/layout/AppHeader.tsx');
    const petRoom = source('components/PetRoom.tsx');

    expect(home).toContain('Серия игр');
    expect(home).toContain('Наклейки за серию');
    expect(home).toContain('Сегодня засчитано ✓');
    expect(home).toContain('userProfile.pet.dailyStreak');
    expect(header).not.toContain('Серия ежедневных заданий');
    expect(header).not.toContain('userProfile.pet.dailyStreak');
    expect(petRoom).not.toContain('НАКЛЕЙКИ ·');
    expect(petRoom).not.toContain('streakDays');
  });
});

describe('mood-driven wardrobe notice', () => {
  it('does not claim an outfit was removed when nothing was equipped', () => {
    const profile = mapProfileFromDB({
      username: 'parent',
      feature_flags: { levelWardrobe: true },
      pet: basePet([], 20),
      stats: {},
      inventory: [],
    });

    expect(profile.petWardrobeAutoRemoved).toBe(false);
    expect(profile.pet.equippedAccessories).toEqual([]);
  });

  it('marks the notice only when low mood actually hides an equipped accessory', () => {
    const profile = mapProfileFromDB({
      username: 'parent',
      feature_flags: { levelWardrobe: true },
      pet: basePet(['blue_hat'], 20),
      stats: {},
      inventory: [],
    });

    expect(profile.petWardrobeAutoRemoved).toBe(true);
    expect(profile.pet.equippedAccessories).toEqual([]);
    expect(source('components/PetRoom.tsx')).toContain('profile.petWardrobeAutoRemoved && mood.moodScore < 34');
  });

  it('keeps the outfit visible when mood is above the auto-remove threshold', () => {
    const profile = mapProfileFromDB({
      username: 'parent',
      feature_flags: { levelWardrobe: true },
      pet: basePet(['blue_hat'], 70),
      stats: {},
      inventory: [],
    });

    expect(profile.petWardrobeAutoRemoved).toBe(false);
    expect(profile.pet.equippedAccessories).toEqual(['blue_hat']);
  });
});
