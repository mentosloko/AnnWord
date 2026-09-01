import { describe, expect, it } from 'vitest';
import { mergeImportedDictionaryTranslations, mergeImportedDictionaryWords } from '../services/dictionarySourceImport';

describe('dictionary source import', () => {
  it('adds selected words without duplicates', () => {
    expect(mergeImportedDictionaryWords(['BOOK', 'PENCIL'], ['PENCIL', 'SCHOOL'])).toEqual(['BOOK', 'PENCIL', 'SCHOOL']);
  });

  it('keeps catalogue translations for selected imported words', () => {
    expect(mergeImportedDictionaryTranslations(
      { BOOK: 'книга' },
      [{ word: 'BOOK', translation: 'книга' }, { word: 'PASSPORT', translation: 'паспорт' }],
      ['PASSPORT'],
    )).toEqual({ BOOK: 'книга', PASSPORT: 'паспорт' });
  });
});
