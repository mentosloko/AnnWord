import type { PetState } from '../types';
import { deriveMoodFromScore, normalizeMoodScore } from './gamificationRules';
import { preserveEarnedStickerIds } from './streakStickerPolicy';

export const PET_MOOD_LOSS_PER_DAY = 8;
export const PET_MOOD_STEP_MS = 3 * 60 * 60 * 1000;

const validTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (value: number): string => new Date(value).toISOString();

export interface PetMoodClockResult {
  pet: PetState;
  changed: boolean;
  initialized: boolean;
  pointsLost: number;
}

/**
 * Applies mood deterioration using only a server-provided clock.
 * One point is lost every three complete hours (eight points per day).
 * The timestamp advances only by consumed three-hour steps so partial time is
 * retained across frequent profile reads instead of being rounded away.
 */
export const applyServerPetMoodClock = (pet: PetState, serverNowMs: number): PetMoodClockResult => {
  const normalizedNow = Number.isFinite(serverNowMs) ? serverNowMs : Date.now();
  const anchorMs = validTimestamp(pet.moodUpdatedAt);
  const currentScore = normalizeMoodScore(pet);

  if (anchorMs === null || anchorMs > normalizedNow) {
    const initializedPet = {
      ...pet,
      moodScore: currentScore,
      mood: deriveMoodFromScore(currentScore),
      hunger: currentScore,
      energy: currentScore,
      moodUpdatedAt: iso(normalizedNow),
    };
    return { pet: initializedPet, changed: true, initialized: true, pointsLost: 0 };
  }

  const completeSteps = Math.floor((normalizedNow - anchorMs) / PET_MOOD_STEP_MS);
  if (completeSteps <= 0) {
    return { pet, changed: false, initialized: false, pointsLost: 0 };
  }

  const nextScore = Math.max(0, currentScore - completeSteps);
  const nextAnchorMs = anchorMs + completeSteps * PET_MOOD_STEP_MS;
  const nextPet: PetState = {
    ...pet,
    moodScore: nextScore,
    mood: deriveMoodFromScore(nextScore),
    hunger: nextScore,
    energy: nextScore,
    moodUpdatedAt: iso(nextAnchorMs),
  };

  return {
    pet: nextPet,
    changed: nextScore !== currentScore || nextPet.moodUpdatedAt !== pet.moodUpdatedAt,
    initialized: false,
    pointsLost: Math.min(currentScore, completeSteps),
  };
};

export const applyServerMoodIncrease = (pet: PetState, delta: number, serverNowMs: number): PetState => {
  const currentScore = normalizeMoodScore(pet);
  const nextScore = Math.min(100, currentScore + Math.max(0, Math.round(delta || 0)));
  return {
    ...pet,
    moodScore: nextScore,
    mood: deriveMoodFromScore(nextScore),
    hunger: nextScore,
    energy: nextScore,
    moodUpdatedAt: iso(serverNowMs),
  };
};

const awardStreakStickers = (pet: PetState, streakDays: number): PetState => ({
  ...pet,
  earnedStickerIds: preserveEarnedStickerIds(pet.earnedStickerIds, streakDays),
});

export const markServerPetActivity = (pet: PetState, moscowDate: string, previousMoscowDate: string): PetState => {
  if (pet.lastDailyActivityDate === moscowDate) {
    return awardStreakStickers(pet, Math.max(0, Math.round(pet.dailyStreak || 0)));
  }
  const nextStreak = pet.lastDailyActivityDate === previousMoscowDate
    ? Math.max(1, Math.round(pet.dailyStreak || 0) + 1)
    : 1;
  return awardStreakStickers({ ...pet, lastDailyActivityDate: moscowDate, dailyStreak: nextStreak }, nextStreak);
};
