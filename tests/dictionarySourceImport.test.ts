import { describe, expect, it } from 'vitest';
import { mergeImportedDictionaryWords } from '../services/dictionarySourceImport';

describe('dictionary source import', () => {
  it('adds selected words without duplicates', () => {
    expect(mergeImportedDictionaryWords(['BOOK', 'PENCIL'], ['PENCIL', 'SCHOOL'])).toEqual(['BOOK', 'PENCIL', 'SCHOOL']);
  });
});
