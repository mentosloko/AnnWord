import { describe, expect, it } from 'vitest';
import type { PetState } from '../types';
import { applyServerMoodIncrease, applyServerPetMoodClock, markServerPetActivity, PET_MOOD_STEP_MS } from '../services/serverPetMoodPolicy';

const pet = (overrides: Partial<PetState> = {}): PetState => ({
  name: 'Дружок',
  type: 'Puppy',
  level: 1,
  mood: 'super_happy',
  xp: 0,
  moodScore: 100,
  hunger: 100,
  energy: 100,
  equippedAccessories: [],
  moodUpdatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const anchor = Date.parse('2026-07-01T00:00:00.000Z');

describe('server pet mood clock', () => {
  it('does not lose a point before a complete three-hour step', () => {
    const result = applyServerPetMoodClock(pet(), anchor + PET_MOOD_STEP_MS - 1);
    expect(result.changed).toBe(false);
    expect(result.pet.moodScore).toBe(100);
    expect(result.pet.moodUpdatedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('loses one point every complete three hours', () => {
    const result = applyServerPetMoodClock(pet(), anchor + PET_MOOD_STEP_MS * 8 + 60 * 60 * 1000);
    expect(result.pointsLost).toBe(8);
    expect(result.pet.moodScore).toBe(92);
    expect(result.pet.moodUpdatedAt).toBe('2026-07-02T00:00:00.000Z');
  });

  it('preserves partial elapsed time between frequent reads', () => {
    const first = applyServerPetMoodClock(pet(), anchor + PET_MOOD_STEP_MS + 30 * 60 * 1000);
    const second = applyServerPetMoodClock(first.pet, anchor + PET_MOOD_STEP_MS * 2);
    expect(first.pet.moodScore).toBe(99);
    expect(first.pet.moodUpdatedAt).toBe('2026-07-01T03:00:00.000Z');
    expect(second.pet.moodScore).toBe(98);
    expect(second.pet.moodUpdatedAt).toBe('2026-07-01T06:00:00.000Z');
  });

  it('never drops below zero', () => {
    const result = applyServerPetMoodClock(pet({ moodScore: 4 }), anchor + PET_MOOD_STEP_MS * 20);
    expect(result.pet.moodScore).toBe(0);
    expect(result.pet.mood).toBe('sad');
    expect(result.pet.hunger).toBe(0);
    expect(result.pet.energy).toBe(0);
  });

  it('initializes a legacy pet without applying retroactive loss', () => {
    const result = applyServerPetMoodClock(pet({ moodScore: 73, moodUpdatedAt: undefined }), anchor);
    expect(result.initialized).toBe(true);
    expect(result.pointsLost).toBe(0);
    expect(result.pet.moodScore).toBe(73);
    expect(result.pet.moodUpdatedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('stamps legitimate server-side mood increases with server time', () => {
    const increased = applyServerMoodIncrease(pet({ moodScore: 40 }), 12, anchor + 1234);
    expect(increased.moodScore).toBe(52);
    expect(increased.moodUpdatedAt).toBe('2026-07-01T00:00:01.234Z');
  });
});

describe('server pet activity', () => {
  it('increments a streak only when the previous activity was yesterday', () => {
    const next = markServerPetActivity(pet({ dailyStreak: 3, lastDailyActivityDate: '2026-07-16' }), '2026-07-17', '2026-07-16');
    expect(next.dailyStreak).toBe(4);
    expect(next.lastDailyActivityDate).toBe('2026-07-17');
  });

  it('does not increment twice on the same day', () => {
    const next = markServerPetActivity(pet({ dailyStreak: 4, lastDailyActivityDate: '2026-07-17' }), '2026-07-17', '2026-07-16');
    expect(next.dailyStreak).toBe(4);
  });
});
