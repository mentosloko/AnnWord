import { COMMON_WORDS_EN } from '../dictionaries/english';
import { EnrichedWord } from '../types';
import { hasRussianTranslation, normalizeWord } from './dictionaryEngine';
import { getUnusedSessionWord, resetSessionWordBucket } from './sessionWordHistory';

export type GameSessionMode = 'anagram' | 'sprint' | 'memory' | 'hangman';
export type AdaptiveGameSessionMode = 'anagram' | 'sprint';
export type WordPracticeResult = 'failed' | 'mastered';

const translatedEntries = (entries: EnrichedWord[]): EnrichedWord[] => entries
  .filter(entry => hasRussianTranslation(entry.translation))
  .map(entry => ({ ...entry, word: normalizeWord(entry.word) }))
  .filter(entry => Boolean(entry.word));

/**
 * Builds the only playable mini-game dictionary: every entry has a real Russian translation.
 * If words are supplied, their order is kept and unsupported entries are discarded.
 */
export const buildPlayableGameDictionary = (
  words: string[] = [],
  fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN,
): EnrichedWord[] => {
  const available = translatedEntries(fallbackDictionary);
  if (words.length === 0) return available;

  const byWord = new Map(available.map(entry => [entry.word, entry]));
  const seen = new Set<string>();
  const playable: EnrichedWord[] = [];
  for (const rawWord of words) {
    const word = normalizeWord(rawWord);
    if (!word || seen.has(word)) continue;
    seen.add(word);
    const entry = byWord.get(word);
    if (entry) playable.push(entry);
  }
  return playable;
};

export const pickNextSessionWord = <T extends { word: string }>(mode: GameSessionMode, pool: T[]): T | null =>
  getUnusedSessionWord(mode, pool);

/**
 * Records unresolved difficulty for Sprint and Anagrams only.
 * One correct answer means the user has handled this word, so its priority is removed.
 */
export const updateReviewPriorities = (
  current: Record<string, number> = {},
  word: string,
  result: WordPracticeResult,
): Record<string, number> => {
  const normalized = normalizeWord(word);
  if (!normalized) return { ...current };
  const next = { ...current };
  if (result === 'mastered') {
    delete next[normalized];
    return next;
  }
  next[normalized] = Math.min(4, Math.max(0, Math.round(next[normalized] || 0)) + 1);
  return next;
};

/**
 * In Sprint and Anagrams, words with unresolved mistakes appear more often.
 * A mastered word is removed from review and immediately stops receiving this extra probability.
 * Consecutive repeats are avoided when possible.
 */
export const pickAdaptiveSessionWord = <T extends { word: string }>(
  mode: AdaptiveGameSessionMode,
  pool: T[],
  wordsToReview: Record<string, number> = {},
  previousWord?: string | null,
  random: () => number = Math.random,
): T | null => {
  if (pool.length === 0) return null;
  const previous = previousWord ? normalizeWord(previousWord) : null;
  const availablePool = previous && pool.length > 1
    ? pool.filter(entry => normalizeWord(entry.word) !== previous)
    : pool;
  const weightedReviewPool = availablePool.flatMap(entry => {
    const misses = Math.max(0, Math.round(wordsToReview[normalizeWord(entry.word)] || 0));
    return Array.from({ length: Math.min(4, misses) }, () => entry);
  });

  if (weightedReviewPool.length > 0 && random() < 0.65) {
    return weightedReviewPool[Math.floor(random() * weightedReviewPool.length)] || null;
  }
  return getUnusedSessionWord(mode, availablePool);
};

export const resetSessionWords = (mode: GameSessionMode): void => resetSessionWordBucket(mode);

export const readStoredGameSession = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

export const writeStoredGameSession = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence must never block gameplay.
  }
};

export const clearStoredGameSession = (...keys: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    keys.forEach(key => window.localStorage.removeItem(key));
  } catch {
    // Ignore restricted storage environments.
  }
};
