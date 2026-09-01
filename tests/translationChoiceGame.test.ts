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

  it('does not invent a distractor when the dictionary has no pair', () => {
    expect(chooseChallengingWrongOption('SHEEP', [pool[0]])).toBeNull();
  });
});
