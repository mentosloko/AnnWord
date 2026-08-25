import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DifficultyPicker } from '../components/dictionary/DifficultyPicker';
import {
  buildDifficultyAvailability,
  CEFR_LEVELS,
  getPlayableEntriesForDifficulty,
  MIN_PLAYABLE_CEFR_WORDS,
} from '../services/difficultyAvailability';
import { ensureGeneralDictionaryLoaded } from '../services/dictionaryRuntime';
import { getFreeKidsDictionaryEntries } from '../services/kidsDictionaryCatalog';
import type { EnrichedWord } from '../types';

let generalEntries: EnrichedWord[] = [];

beforeAll(async () => {
  generalEntries = (await ensureGeneralDictionaryLoaded()).COMMON_WORDS_EN;
});

describe('CEFR compatibility', () => {
  it('keeps only actually playable kids CEFR levels available', () => {
    const availability = buildDifficultyAvailability(getFreeKidsDictionaryEntries('ALL'));
    const byLevel = new Map(availability.map(item => [item.level, item]));

    expect(byLevel.get('ALL')?.available).toBe(true);
    expect(byLevel.get('A1')?.available).toBe(true);
    for (const level of ['A2', 'B1', 'B2', 'C1', 'C2'] as const) {
      expect(byLevel.get(level)?.available).toBe(false);
      expect(byLevel.get(level)?.playableCount).toBe(0);
    }
  });

  it('every CEFR level exposed as available has a non-empty stable game pool', () => {
    const availability = buildDifficultyAvailability(generalEntries);
    for (const level of CEFR_LEVELS) {
      const item = availability.find(candidate => candidate.level === level)!;
      const pool = getPlayableEntriesForDifficulty(generalEntries, level);
      if (item.available) {
        expect(pool.length).toBeGreaterThanOrEqual(MIN_PLAYABLE_CEFR_WORDS);
        expect(pool.every(word => Boolean(word.translation.trim()))).toBe(true);
      } else {
        expect(pool.length).toBeLessThan(MIN_PLAYABLE_CEFR_WORDS);
      }
    }
  });

  it('disables incomplete levels and explains why they cannot be selected', () => {
    render(<DifficultyPicker value="ALL" kidsMode onChange={vi.fn()} />);

    const unavailableA2 = screen.getByRole('button', { name: /Уровень A2 пока недоступен/ });
    expect(unavailableA2).toBeDisabled();
    expect(screen.getByText(/меньше трёх подходящих игровых слов с русским переводом/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A1' })).toBeEnabled();
  });
});
