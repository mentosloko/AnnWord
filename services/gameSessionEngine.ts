import { COMMON_WORDS_EN } from '../dictionaries/english';
import { EnrichedWord } from '../types';
import { hasRussianTranslation, normalizeWord } from './wordNormalization';
import { getUnusedSessionWord, resetSessionWordBucket } from './sessionWordHistory';
import { updateReviewPriorities, type WordPracticeResult } from './wordPracticeProgress';

export { updateReviewPriorities } from './wordPracticeProgress';
export type { WordPracticeResult } from './wordPracticeProgress';

export type GameSessionMode = 'anagram' | 'sprint' | 'memory' | 'hangman' | 'translation' | 'letterSquare';
export type AdaptiveGameSessionMode = 'anagram' | 'sprint' | 'translation' | 'letterSquare';

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

const preferNonTransliterated = <T extends { word: string; isTransliterated?: boolean }>(pool: T[], random: () => number = Math.random): T[] => {
  const natural = pool.filter(entry => entry.isTransliterated !== true);
  if (!natural.length) return pool;
  return random() < 0.97 ? natural : pool;
};

export const pickNextSessionWord = <T extends { word: string; isTransliterated?: boolean }>(mode: GameSessionMode, pool: T[]): T | null =>
  getUnusedSessionWord(mode, preferNonTransliterated(pool));

/**
 * Records unresolved difficulty for Sprint, Anagrams and Translation Choice only.
 * One correct answer means the user has handled this word, so its priority is removed.
 */
export { type WordPracticeResult };

/**
 * In adaptive modes, words with unresolved mistakes appear more often.
 * A mastered word is removed from review and immediately stops receiving this extra probability.
 * Consecutive repeats are avoided when possible. Transliterated entries remain available,
 * but enter the normal selection pool only in about 3% of selections when natural entries exist.
 */
export const pickAdaptiveSessionWord = <T extends { word: string; isTransliterated?: boolean }>(
  mode: AdaptiveGameSessionMode,
  pool: T[],
  wordsToReview: Record<string, number> = {},
  previousWord?: string | null,
  random: () => number = Math.random,
): T | null => {
  if (pool.length === 0) return null;
  const previous = previousWord ? normalizeWord(previousWord) : null;
  const withoutPrevious = previous && pool.length > 1
    ? pool.filter(entry => normalizeWord(entry.word) !== previous)
    : pool;
  const availablePool = preferNonTransliterated(withoutPrevious, random);
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
