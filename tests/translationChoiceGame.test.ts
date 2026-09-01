import { describe, expect, it } from 'vitest';
import { chooseChallengingWrongOption } from '../components/TranslationChoiceGame';

describe('TranslationChoiceGame challenging pairs', () => {
  const pool = [
    { word: 'SHEEP', translation: 'овца', level: 'A1' as const },
    { word: 'SHEET', translation: 'лист', level: 'A1' as const },
    { word: 'PENCIL', translation: 'карандаш', level: 'A1' as const },
  ];

  it('uses an existing close dictionary word instead of mutating letters', () => {
    expect(chooseChallengingWrongOption('SHEEP', pool)).toBe('SHEET');
  });

  it('prefers a one-edit pair even when another candidate has the same length', () => {
    expect(chooseChallengingWrongOption('BOOK', [
      { word: 'BOOK', translation: 'книга', level: 'A1' },
      { word: 'MILK', translation: 'молоко', level: 'A1' },
      { word: 'BOOKS', translation: 'книги', level: 'A1' },
    ])).toBe('BOOKS');
  });

  it('does not invent a distractor when the dictionary has no pair', () => {
    expect(chooseChallengingWrongOption('SHEEP', [pool[0]])).toBeNull();
  });
});
