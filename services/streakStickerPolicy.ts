export interface StreakStickerMilestone {
  id: string;
  days: number;
}

export const STREAK_STICKER_MILESTONES: StreakStickerMilestone[] = [
  { id: 'streak_1', days: 1 },
  { id: 'streak_3', days: 3 },
  { id: 'streak_7', days: 7 },
  { id: 'streak_14', days: 14 },
  { id: 'streak_30', days: 30 },
];

export const getStickerIdsEarnedForStreak = (days: number): string[] => {
  const normalizedDays = Math.max(0, Math.round(days || 0));
  return STREAK_STICKER_MILESTONES
    .filter(sticker => normalizedDays >= sticker.days)
    .map(sticker => sticker.id);
};

export const preserveEarnedStickerIds = (currentIds: string[] | undefined, streakDays: number): string[] => Array.from(new Set([
  ...(currentIds || []),
  ...getStickerIdsEarnedForStreak(streakDays),
]));
