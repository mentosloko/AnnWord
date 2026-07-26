export type ScoreDirection = 'lower' | 'higher';

export interface PersonalScoreEntry {
  value: number;
  recordedAt: string;
}

const STORAGE_PREFIX = 'annword:personal-scoreboard:v1';
const MAX_STORED_RESULTS = 30;

const cleanValue = (value: number): number => Math.max(0, Math.round(Number(value) || 0));
const storageKey = (userKey: string, gameId: string): string =>
  `${STORAGE_PREFIX}:${encodeURIComponent((userKey || 'guest').trim().toLowerCase())}:${gameId}`;

export const rankPersonalScores = (
  entries: PersonalScoreEntry[],
  direction: ScoreDirection,
): PersonalScoreEntry[] => [...entries]
  .filter(entry => Number.isFinite(entry.value) && entry.value >= 0)
  .sort((first, second) => direction === 'lower'
    ? first.value - second.value || first.recordedAt.localeCompare(second.recordedAt)
    : second.value - first.value || first.recordedAt.localeCompare(second.recordedAt));

export const readPersonalScores = (userKey: string, gameId: string): PersonalScoreEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(userKey, gameId)) || '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is PersonalScoreEntry => Boolean(entry) && Number.isFinite(Number(entry.value)) && typeof entry.recordedAt === 'string')
      .map(entry => ({ value: cleanValue(entry.value), recordedAt: entry.recordedAt }));
  } catch {
    return [];
  }
};

export const recordPersonalScore = (
  userKey: string,
  gameId: string,
  value: number,
  direction: ScoreDirection,
): PersonalScoreEntry[] => {
  const entry = { value: cleanValue(value), recordedAt: new Date().toISOString() };
  const ranked = rankPersonalScores([...readPersonalScores(userKey, gameId), entry], direction).slice(0, MAX_STORED_RESULTS);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(userKey, gameId), JSON.stringify(ranked));
    } catch {
      // A scoreboard must never block the result screen.
    }
  }
  return ranked;
};
