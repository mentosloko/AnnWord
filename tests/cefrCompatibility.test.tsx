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
import { getKidsCefrEntries } from '../services/kidsCefrDictionary';
import type { EnrichedWord } from '../types';

let generalEntries: EnrichedWord[] = [];

beforeAll(async () => {
  generalEntries = (await ensureGeneralDictionaryLoaded()).COMMON_WORDS_EN;
});

describe('CEFR compatibility', () => {
  it('exposes every CEFR level from the filtered Kids pool', () => {
    const entries = getKidsCefrEntries(generalEntries);
    const availability = buildDifficultyAvailability(entries);

    expect(entries).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ word: 'BEER' }),
      expect.objectContaining({ word: 'MURDER' }),
      expect.objectContaining({ word: 'PORN' }),
    ]));
    for (const level of CEFR_LEVELS) {
      const item = availability.find(candidate => candidate.level === level);
      expect(item?.available).toBe(true);
      expect(item?.playableCount).toBeGreaterThanOrEqual(MIN_PLAYABLE_CEFR_WORDS);
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

  it('keeps every Kids CEFR selector available', () => {
    render(<DifficultyPicker value="ALL" kidsMode onChange={vi.fn()} />);

    for (const level of CEFR_LEVELS) {
      expect(screen.getByRole('button', { name: level })).toBeEnabled();
    }
    expect(screen.queryByText(/меньше трёх подходящих игровых слов с русским переводом/)).not.toBeInTheDocument();
  });
});
