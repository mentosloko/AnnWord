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
  ensureSpotlightDictionaryLoaded,
  getSpotlightEntries,
  getSpotlightSections,
  resetSpotlightDictionaryForTests,
  resolveSpotlightSelection,
} from '../services/spotlightDictionary';
import type { DailyQuestState } from '../types';

describe('Spotlight runtime consistency', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSpotlightDictionaryForTests();
    resetActiveGameDictionaryEntriesForTests();
  });

  it('restores the stored grade and module before the game pool is built', async () => {
    await ensureSpotlightDictionaryLoaded();
    const section = getSpotlightSections(5).find(item => item.wordCount > 0);
    expect(section).toBeTruthy();

    window.localStorage.setItem('annword_spotlight_selection_v1:child@example.com', JSON.stringify({
      grade: 5,
      sectionId: section!.id,
    }));

    expect(resolveSpotlightSelection(undefined, undefined, 'child@example.com')).toEqual({
      grade: 5,
      sectionId: section!.id,
    });
  });

  it('keeps the selected Spotlight words and translations in mini games', async () => {
    await ensureSpotlightDictionaryLoaded();
    const section = getSpotlightSections(6).find(item => item.wordCount > 0);
    expect(section).toBeTruthy();
    const selectedEntries = getSpotlightEntries(6, section!.id);
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
