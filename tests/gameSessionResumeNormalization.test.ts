import { describe, expect, it } from 'vitest';
import type { EnrichedWord } from '../types';
import { normalizeSavedMemoryState } from '../components/MemoryGame';

const dictionary: EnrichedWord[] = [
  { word: 'PANDA', translation: 'панда', level: 'A1' },
  { word: 'TIGER', translation: 'тигр', level: 'A1' },
];

const baseCards = [
  { id: 0, content: 'PANDA', type: 'en' as const, pairId: 0, isFlipped: false, isMatched: false },
  { id: 1, content: 'панда', type: 'ru' as const, pairId: 0, isFlipped: false, isMatched: false },
  { id: 2, content: 'TIGER', type: 'en' as const, pairId: 1, isFlipped: false, isMatched: false },
  { id: 3, content: 'тигр', type: 'ru' as const, pairId: 1, isFlipped: false, isMatched: false },
];

describe('resumable game state normalization', () => {
  it('finishes a matching Memory pair when reload interrupts the match timer', () => {
    const state = normalizeSavedMemoryState({
      cards: baseCards.map(card => card.id === 0 || card.id === 1 ? { ...card, isFlipped: true } : card),
      flippedCards: [0, 1],
      moves: 3,
    }, dictionary);

    expect(state?.flippedCards).toEqual([]);
    expect(state?.moves).toBe(3);
    expect(state?.cards.filter(card => card.pairId === 0).every(card => card.isMatched)).toBe(true);
  });

  it('closes a mismatched Memory pair when reload interrupts the flip-back timer', () => {
    const state = normalizeSavedMemoryState({
      cards: baseCards.map(card => card.id === 0 || card.id === 2 ? { ...card, isFlipped: true } : card),
      flippedCards: [0, 2],
      moves: 4,
    }, dictionary);

    expect(state?.flippedCards).toEqual([]);
    expect(state?.moves).toBe(4);
    expect(state?.cards.find(card => card.id === 0)?.isFlipped).toBe(false);
    expect(state?.cards.find(card => card.id === 2)?.isFlipped).toBe(false);
  });
});
