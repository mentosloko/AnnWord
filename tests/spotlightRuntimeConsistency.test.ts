import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildPlayableGameDictionary,
  resetActiveGameDictionaryEntriesForTests,
  setActiveGameDictionaryEntries,
} from '../services/gameSessionEngine';
import {
  DAILY_QUEST_DEFINITIONS,
  doesGameResultCompleteDailyQuest,
} from '../services/dailyQuest';
import {
  canonicalizeSpotlightSectionIds,
  ensureSpotlightDictionaryLoaded,
  getSpotlightCompactSelectionLabel,
  getSpotlightEntries,
  getSpotlightGrades,
  getSpotlightSections,
  getSpotlightSelectionLabel,
  resetSpotlightDictionaryForTests,
  resolveSpotlightSelection,
  storeSpotlightSelection,
  toggleSpotlightSectionSelection,
} from '../services/spotlightDictionary';
import type { DailyQuestState } from '../types';

const findGradeWithSections = (minimum: number) => {
  for (const grade of getSpotlightGrades()) {
    const sections = getSpotlightSections(grade).filter(item => item.wordCount > 0);
    if (sections.length >= minimum) return { grade, sections };
  }
  throw new Error(`Spotlight fixture needs at least ${minimum} populated sections in one grade.`);
};

describe('Spotlight runtime consistency', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSpotlightDictionaryForTests();
    resetActiveGameDictionaryEntriesForTests();
  });

  it('migrates a stored legacy single module before the game pool is built', async () => {
    await ensureSpotlightDictionaryLoaded();
    const section = getSpotlightSections(5).find(item => item.wordCount > 0);
    expect(section).toBeTruthy();

    window.localStorage.setItem('annword_spotlight_selection_v1:child@example.com', JSON.stringify({
      grade: 5,
      sectionId: section!.id,
    }));

    expect(resolveSpotlightSelection(undefined, undefined, 'child@example.com')).toEqual({
      grade: 5,
      sectionIds: [section!.id],
      sectionId: section!.id,
    });
  });

  it('round-trips a multi-module local fallback while retaining legacy compatibility', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    storeSpotlightSelection('child@example.com', { grade, sectionIds: [sections[1].id, sections[0].id] });

    const raw = JSON.parse(window.localStorage.getItem('annword_spotlight_selection_v1:child@example.com') || '{}');
    expect(raw.sectionIds).toEqual([sections[0].id, sections[1].id]);
    expect(raw.sectionId).toBe(sections[0].id);
    expect(resolveSpotlightSelection(undefined, undefined, 'child@example.com').sectionIds).toEqual([sections[0].id, sections[1].id]);
  });

  it('merges multiple selected modules with deduplicated words and translations', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const first = getSpotlightEntries(grade, sections[0].id);
    const second = getSpotlightEntries(grade, sections[1].id);
    const merged = getSpotlightEntries(grade, [sections[0].id, sections[1].id]);
    const expectedWords = new Set([...first, ...second].map(entry => entry.word));

    expect(new Set(merged.map(entry => entry.word))).toEqual(expectedWords);
    expect(merged.length).toBe(expectedWords.size);
    expect(new Set(merged.map(entry => entry.word)).size).toBe(merged.length);
    expect(merged.every(entry => Boolean(entry.translation))).toBe(true);
  });

  it('makes all-class mutually exclusive and prevents an accidental empty module selection', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const first = toggleSpotlightSectionSelection(grade, ['all'], sections[0].id);
    expect(first).toEqual([sections[0].id]);
    const two = toggleSpotlightSectionSelection(grade, first, sections[1].id);
    expect(two).toEqual([sections[0].id, sections[1].id]);
    expect(toggleSpotlightSectionSelection(grade, two, 'all')).toEqual(['all']);
    expect(toggleSpotlightSectionSelection(grade, [sections[0].id], sections[0].id)).toEqual([sections[0].id]);
  });

  it('filters unavailable section ids and restores all-class if no valid module remains', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(1);
    expect(canonicalizeSpotlightSectionIds(grade, [sections[0].id, 'missing-module'])).toEqual([sections[0].id]);
    expect(canonicalizeSpotlightSectionIds(grade, ['missing-module'])).toEqual(['all']);
  });

  it('keeps full module names in settings but bounds the label shown inside games', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(3);
    const ids = sections.slice(0, 3).map(section => section.id);
    const full = getSpotlightSelectionLabel(grade, ids);
    const compact = getSpotlightCompactSelectionLabel(grade, ids);

    for (const section of sections.slice(0, 3)) expect(full).toContain(section.title);
    expect(compact).toContain(`${grade} класс`);
    expect(compact).toContain('+ ещё 1');
    expect(compact.length).toBeLessThan(full.length);
  });

  it('keeps the selected Spotlight words and translations in mini games', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const selectedEntries = getSpotlightEntries(grade, [sections[0].id, sections[1].id]);
    expect(selectedEntries.length).toBeGreaterThan(0);

    setActiveGameDictionaryEntries(selectedEntries);
    const playable = buildPlayableGameDictionary(selectedEntries.map(entry => entry.word), []);

    expect(playable).toEqual(selectedEntries);
  });
});

describe('Memory daily quest targets', () => {
  it('never offers a Memory target below eight moves', () => {
    const memoryDefinitions = Object.entries(DAILY_QUEST_DEFINITIONS)
      .filter(([key]) => key.startsWith('memory_'))
      .map(([, definition]) => Number(definition.description.match(/(\d+)\s+ход/)?.[1] || 0));

    expect(memoryDefinitions.length).toBeGreaterThan(0);
    expect(Math.min(...memoryDefinitions)).toBeGreaterThanOrEqual(8);
  });

  it('accepts the easiest Memory quest at eight moves but not nine', () => {
    const definition = DAILY_QUEST_DEFINITIONS.memory_twelve;
    const quest: DailyQuestState = {
      questDate: '2026-08-01',
      kind: 'memory_sixteen',
      title: definition.title,
      description: definition.description,
      progressLabel: 'Ещё не выполнено',
      completed: false,
    };

    expect(doesGameResultCompleteDailyQuest(quest, { type: 'memory', moves: 8 })).toBe(true);
    expect(doesGameResultCompleteDailyQuest(quest, { type: 'memory', moves: 9 })).toBe(false);
  });
});
