import { describe, expect, it } from 'vitest';
import { normalizeDictionaryToken, parseDictionaryText } from '../services/dictionaryUpload';

describe('dictionaryUpload', () => {
  it('normalizes tokens to uppercase English words', () => {
    expect(normalizeDictionaryToken(' apple ')).toBe('APPLE');
    expect(normalizeDictionaryToken('fox!')).toBe('FOX');
    expect(normalizeDictionaryToken('мир')).toBe('');
  });

  it('deduplicates words and returns import diagnostics', () => {
    const result = parseDictionaryText([' apple ', 'APPLE', 'stone', 'fox!', 'data', 'stones'].join('\n'));

    expect(result.words).toEqual(['APPLE', 'STONE', 'FOX', 'DATA', 'STONES']);
    expect(result.diagnostics).toMatchObject({
      rawTokenCount: 6,
      normalizedTokenCount: 6,
      importedCount: 5,
      duplicateCount: 1,
      invalidTokenCount: 1,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'Удалены дубликаты: 1.',
      'Очищены токены с неанглийскими символами: 1.',
    ]));
  });

  it('does not silently truncate large dictionaries', () => {
    const words = Array.from({ length: 250 }, (_, index) => `WORD${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`);
    const result = parseDictionaryText(words.join('\n'));

    expect(result.words).toHaveLength(250);
    expect(result.diagnostics.importedCount).toBe(250);
    expect(result.diagnostics.invalidTokenCount).toBe(0);
  });

  it('returns a blocking-style warning when no words are importable', () => {
    const result = parseDictionaryText('123 !!! ---');

    expect(result.words).toEqual([]);
    expect(result.diagnostics.importedCount).toBe(0);
    expect(result.warnings).toContain('Не найдено ни одного английского слова для импорта.');
  });
});
