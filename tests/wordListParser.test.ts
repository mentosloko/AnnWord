import { describe, expect, it } from 'vitest';
import {
  analyzeEnglishWordList,
  formatEnglishWordList,
  normalizeEnglishWordArray,
  parseEnglishWordList,
} from '../utils/wordListParser';

describe('word list parser', () => {
  it('normalizes mixed case and arbitrary separators', () => {
    expect(parseEnglishWordList('Hi, KITE; fine / ride | DRIVE\nhome\ttree • house')).toEqual([
      'HI', 'KITE', 'FINE', 'RIDE', 'DRIVE', 'HOME', 'TREE', 'HOUSE',
    ]);
  });

  it('removes numbering, Cyrillic text and duplicate words', () => {
    expect(parseEnglishWordList('1. apple\n2) APPLE\nслово: school\n03 — Friend')).toEqual([
      'APPLE', 'SCHOOL', 'FRIEND',
    ]);
  });

  it('preserves apostrophes and compound-word hyphens', () => {
    expect(parseEnglishWordList("don't, DON’T; mother–in–law; rock-'n'-roll")).toEqual([
      "DON'T", 'MOTHER-IN-LAW', 'ROCK', 'N', 'ROLL',
    ]);
  });

  it('keeps valid one-letter English words', () => {
    expect(parseEnglishWordList('a / I / x')).toEqual(['A', 'I', 'X']);
  });

  it('normalizes arrays and formats one word per line', () => {
    expect(normalizeEnglishWordArray(['Hi, kite', 'KITE / fine'])).toEqual(['HI', 'KITE', 'FINE']);
    expect(formatEnglishWordList('Hi, kite; fine')).toBe('HI\nKITE\nFINE');
  });

  it('reports duplicates and words outside the 4–6 letter game range', () => {
    expect(analyzeEnglishWordList('go GO school elephant')).toEqual({
      words: ['GO', 'SCHOOL', 'ELEPHANT'],
      hasDuplicates: true,
      outsideLength: ['GO', 'ELEPHANT'],
    });
  });
});
