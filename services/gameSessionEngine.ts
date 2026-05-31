import { COMMON_WORDS_EN } from '../dictionaries/english';
import { EnrichedWord } from '../types';
import { hasRussianTranslation, normalizeWord } from './dictionaryEngine';
import { getUnusedSessionWord, resetSessionWordBucket } from './sessionWordHistory';

export type GameSessionMode = 'anagram' | 'sprint' | 'memory' | 'hangman';

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
