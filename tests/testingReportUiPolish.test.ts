import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatRussianCount } from '../utils/textUtils';

const WORD_FORMS = ['слово', 'слова', 'слов'] as const;

describe('testing report UI polish', () => {
  it('inflects word counts including 11–14 exceptions', () => {
    expect(formatRussianCount(1, WORD_FORMS)).toBe('1 слово');
    expect(formatRussianCount(4, WORD_FORMS)).toBe('4 слова');
    expect(formatRussianCount(11, WORD_FORMS)).toBe('11 слов');
    expect(formatRussianCount(14, WORD_FORMS)).toBe('14 слов');
    expect(formatRussianCount(31, WORD_FORMS)).toBe('31 слово');
  });

  it('marks Anagram coins as earned in-session and removes the disabled screenshot promise', () => {
    const anagram = readFileSync('components/AnagramGame.tsx', 'utf8');
    const landing = readFileSync('components/screens/LandingMixScreen.tsx', 'utf8');

    expect(anagram).toContain('Монеты: +{coinsEarned}');
    expect(landing).not.toContain('>Скриншот</span>');
    expect(landing).toContain('>Вставка текста</span>');
  });
});
