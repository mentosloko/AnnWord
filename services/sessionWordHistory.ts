const STORAGE_KEY = 'annword_session_word_history_v1';

type SessionWordBuckets = Record<string, string[]>;

const normalizeWord = (word: string): string => word.trim().toUpperCase();
let testBuckets: SessionWordBuckets = {};

const isTestEnvironment = (): boolean => {
  try {
    return import.meta.env?.MODE === 'test';
  } catch {
    return false;
  }
};

const readBuckets = (): SessionWordBuckets => {
  if (isTestEnvironment()) return testBuckets;
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SessionWordBuckets;
  } catch {
    return {};
  }
};

const writeBuckets = (buckets: SessionWordBuckets) => {
  if (isTestEnvironment()) {
    testBuckets = buckets;
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
  } catch {
    // Ignore storage errors. Games should remain playable even in restricted browsers.
  }
};

/**
 * Picks from unused words first. A preferred pool may bias the choice (for
 * review words), but can never reintroduce a word already shown in this pass.
 */
export const getUnusedSessionWord = <T extends { word: string }>(
  bucketKey: string,
  pool: T[],
  preferredPool: T[] = [],
  random: () => number = Math.random,
): T | null => {
  if (pool.length === 0) return null;

  const buckets = readBuckets();
  const usedWords = new Set((buckets[bucketKey] || []).map(normalizeWord));
  const unusedPool = pool.filter(entry => !usedWords.has(normalizeWord(entry.word)));
  const candidatePool = unusedPool.length > 0 ? unusedPool : pool;
  const preferredWords = new Set(preferredPool.map(entry => normalizeWord(entry.word)));
  const preferredCandidates = candidatePool.filter(entry => preferredWords.has(normalizeWord(entry.word)));
  const selectionPool = preferredCandidates.length > 0 ? preferredCandidates : candidatePool;
  const selected = selectionPool[Math.floor(random() * selectionPool.length)];
  const normalizedSelected = normalizeWord(selected.word);

  const nextUsed = unusedPool.length > 0
    ? [...usedWords, normalizedSelected]
    : [normalizedSelected];

  buckets[bucketKey] = Array.from(new Set(nextUsed));
  writeBuckets(buckets);

  return selected;
};

export const resetSessionWordBucket = (bucketKey: string) => {
  const buckets = readBuckets();
  delete buckets[bucketKey];
  writeBuckets(buckets);
};

export const resetAllSessionWordBucketsForTests = (): void => {
  testBuckets = {};
};
