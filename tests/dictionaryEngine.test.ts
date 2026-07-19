import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildDictionaryPools,
  getBuiltinSecretWordPool,
  getCustomSecretWordPool,
  getDictionaryEmptyStateMessage,
  getValidationPool,
  isAllowedSecretWord,
  normalizeCustomDictionary,
  normalizeWord,
  pickRandomSecretWord,
} from '../services/dictionaryEngine';
import { ensureGeneralDictionaryLoaded } from '../services/dictionaryRuntime';
import { prepareGameDictionary, isValidGuessForGame, pickSecretForGame } from '../services/gameDictionaryAdapter';

describe('dictionaryEngine', () => {
  beforeAll(async () => {
    await ensureGeneralDictionaryLoaded();
  });

  it('normalizes and deduplicates custom dictionaries', () => {
    expect(normalizeWord(' stone! ')).toBe('STONE');
    expect(normalizeCustomDictionary([' apple ', 'APPLE', 'fox!', 'мир'])).toEqual(['APPLE', 'FOX']);
  });

  it('filters disallowed plural-like secret words while allowing SS endings', () => {
    expect(isAllowedSecretWord('STONES')).toBe(false);
    expect(isAllowedSecretWord('CLASS')).toBe(true);
    expect(isAllowedSecretWord('STONE')).toBe(true);
  });

  it('builds custom secret and validation pools by selected word length', () => {
    const customWords = ['apple', 'stone', 'data', 'stones'];
    const secretPool = getCustomSecretWordPool(customWords, 5);
    const validationPool = getValidationPool({ wordLength: 5, customDictionaryEn: customWords });

    expect(secretPool.map(item => item.word)).toEqual(['APPLE', 'STONE']);
    expect(validationPool).toEqual(expect.arrayContaining(['APPLE', 'STONE']));
    expect(validationPool).not.toContain('DATA');
  });

  it('falls back to builtin when custom dictionary is empty', () => {
    const pools = buildDictionaryPools({
      source: 'custom',
      wordLength: 5,
      difficulty: 'ALL',
      customDictionaryEn: [],
    });

    expect(pools.dictionarySourceUsed).toBe('builtin');
    expect(pools.secretWordPool.length).toBeGreaterThan(0);
  });

  it('filters builtin pool by length and difficulty', () => {
    const pool = getBuiltinSecretWordPool({ wordLength: 5, difficulty: 'A1' });

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(item => item.word.length === 5)).toBe(true);
    expect(pool.every(item => item.level === 'A1')).toBe(true);
  });

  it('picks random secret deterministically when random function is injected', () => {
    const pool = getCustomSecretWordPool(['apple', 'stone'], 5);

    expect(pickRandomSecretWord(pool, () => 0)?.word).toBe('APPLE');
    expect(pickRandomSecretWord(pool, () => 0.99)?.word).toBe('STONE');
    expect(pickRandomSecretWord([], () => 0)).toBeNull();
  });

  it('prepares game dictionary with explicit empty custom message', () => {
    const dictionary = prepareGameDictionary({
      settings: { wordLength: 6, dictionarySource: 'custom', difficulty: 'ALL' },
      userProfile: { customDictionaryEn: ['cat', 'dog'] },
    });

    expect(dictionary.errorMessage).toBe(getDictionaryEmptyStateMessage({
      source: 'custom',
      wordLength: 6,
      difficulty: 'ALL',
      customDictionaryEn: ['cat', 'dog'],
    }));
  });

  it('validates guesses and picks game secret through adapter', () => {
    const dictionary = prepareGameDictionary({
      settings: { wordLength: 5, dictionarySource: 'custom', difficulty: 'ALL' },
      userProfile: { customDictionaryEn: ['apple', 'stone', 'data'] },
    });

    expect(dictionary.errorMessage).toBeNull();
    expect(dictionary.dictionarySourceUsed).toBe('custom');
    expect(isValidGuessForGame('stone', dictionary)).toBe(true);
    expect(isValidGuessForGame('data', dictionary)).toBe(false);
    expect(pickSecretForGame(dictionary, () => 0)?.word).toBe('APPLE');
  });
});
