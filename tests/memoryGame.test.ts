import { describe, expect, it } from 'vitest';
import { buildMemoryDictionary, createMemoryCards } from '../components/MemoryGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';

describe('memory game dictionary and pair generation', () => {
  it('creates English to Russian card pairs instead of duplicated English words', () => {
    const dictionary = [
      {
        word: 'CAT',
        translation: 'кот',
        level: 'A1' as const,
      },
    ];

    const cards = createMemoryCards(dictionary, () => 0.1);

    expect(cards).toHaveLength(2);

    const enCard = cards.find(card => card.type === 'en');
    const ruCard = cards.find(card => card.type === 'ru');

    expect(enCard?.content).toBe('CAT');
    expect(ruCard?.content).toBe('кот');
    expect(enCard?.content).not.toBe(ruCard?.content);
  });

  it('reuses builtin translations for custom dictionary words', () => {
    const dictionary = buildMemoryDictionary(['BABY', 'BACK', 'AREA', 'ARTS', 'AWAY', 'ATOM'], COMMON_WORDS_EN);

    expect(dictionary).toHaveLength(6);

    expect(dictionary.every(entry => Boolean(entry.translation))).toBe(true);

    const baby = dictionary.find(entry => entry.word === 'BABY');
    expect(baby?.translation).toBe('ребенок');
  });

  it('falls back to builtin dictionary when custom words have no translations', () => {
    const dictionary = buildMemoryDictionary(['ZZZZZ', 'QQQQQ'], COMMON_WORDS_EN);

    expect(dictionary.length).toBeGreaterThan(6);
    expect(dictionary.every(entry => Boolean(entry.translation))).toBe(true);
  });
});
