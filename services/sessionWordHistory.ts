const STORAGE_KEY = 'annword_session_word_history_v1';

type SessionWordBuckets = Record<string, string[]>;

const normalizeWord = (word: string): string => word.trim().toUpperCase();

const isTestEnvironment = (): boolean => {
  try {
    return import.meta.env?.MODE === 'test';
  } catch {
    return false;
  }
};

const readBuckets = (): SessionWordBuckets => {
  if (typeof window === 'undefined' || isTestEnvironment()) return {};
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
  if (typeof window === 'undefined' || isTestEnvironment()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
  } catch {
    // Ignore storage errors. Games should remain playable even in restricted browsers.
  }
};

export const getUnusedSessionWord = <T extends { word: string }>(bucketKey: string, pool: T[]): T | null => {
  if (pool.length === 0) return null;

  if (isTestEnvironment()) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const buckets = readBuckets();
  const usedWords = new Set((buckets[bucketKey] || []).map(normalizeWord));
  const unusedPool = pool.filter(entry => !usedWords.has(normalizeWord(entry.word)));
  const candidatePool = unusedPool.length > 0 ? unusedPool : pool;
  const selected = candidatePool[Math.floor(Math.random() * candidatePool.length)];
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
