import { beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSpotlightGradeLoaded,
  getSpotlightEntries,
  getSpotlightGradeMeta,
  getSpotlightSelectionLabel,
  resetSpotlightRuntimeForTests,
} from '../services/spotlightDictionaryCatalog';

describe('Spotlight Premium dictionary', () => {
  beforeEach(() => resetSpotlightRuntimeForTests());

  it('loads a full grade and preserves the corrected vocabulary', async () => {
    await ensureSpotlightGradeLoaded(3);
    const entries = getSpotlightEntries(3, 'all');
    expect(entries).toHaveLength(getSpotlightGradeMeta(3).wordCount);
    expect(entries.some(entry => entry.word === 'QUIET')).toBe(true);
    expect(entries.some(entry => entry.word === 'QUIRT')).toBe(false);
    expect(entries.every(entry => /^[A-Z]+$/.test(entry.word))).toBe(true);
  });

  it('returns exactly the selected module and creates a readable label', async () => {
    const grade = getSpotlightGradeMeta(7);
    const module = grade.modules[0];
    await ensureSpotlightGradeLoaded(7);
    expect(getSpotlightEntries(7, module.id)).toHaveLength(module.wordCount);
    expect(getSpotlightSelectionLabel({ activeSpotlightGrade: 7, activeSpotlightSectionId: module.id })).toContain('Spotlight · 7 класс');
  });
});
