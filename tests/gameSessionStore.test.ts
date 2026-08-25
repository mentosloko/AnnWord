import { beforeEach, describe, expect, it } from 'vitest';
import {
  GAME_SESSION_SCHEMA_VERSION,
  clearPersistedGameSession,
  gameSessionStorageKeyForTests,
  isPersistedSessionFor,
  persistGameSession,
  readPersistedGameSession,
  routeForPersistedGame,
} from '../services/gameSessionStore';

const OWNER = 'user-1';

beforeEach(() => window.localStorage.clear());

describe('gameSessionStore', () => {
  it('stores one versioned session envelope with dictionary snapshot and score', () => {
    persistGameSession(OWNER, {
      gameType: 'translation',
      dictionaryId: 'premium:kids_animals',
      dictionaryWords: ['tiger', 'zebra', 'tiger'],
      dictionaryLabel: 'Животные',
      dictionaryIcon: '🐾',
      state: { answered: 3, selected: 'TIGER' },
      score: { correct: 2 },
      rewardState: 'active',
    });

    expect(readPersistedGameSession(OWNER)).toMatchObject({
      schemaVersion: GAME_SESSION_SCHEMA_VERSION,
      gameType: 'translation',
      dictionaryId: 'premium:kids_animals',
      dictionaryWords: ['TIGER', 'ZEBRA'],
      dictionaryLabel: 'Животные',
      state: { answered: 3, selected: 'TIGER' },
      score: { correct: 2 },
      rewardState: 'active',
    });
  });

  it('keeps only the latest saved game for the owner', () => {
    persistGameSession(OWNER, {
      gameType: 'memory',
      dictionaryId: 'one',
      dictionaryWords: ['PANDA'],
      state: { moves: 2 },
      score: 2,
    });
    persistGameSession(OWNER, {
      gameType: 'letter_square',
      dictionaryId: 'two',
      dictionaryWords: ['TIGER'],
      state: { answered: 1 },
      score: 1,
    });

    const session = readPersistedGameSession(OWNER);
    expect(session?.gameType).toBe('letter_square');
    expect(routeForPersistedGame(session!.gameType)).toBe('letter_square');
    expect(isPersistedSessionFor(session, 'memory')).toBe(false);
    expect(isPersistedSessionFor(session, 'letter_square', 'two')).toBe(true);
  });

  it('clears corrupted or incompatible payloads instead of returning a broken session', () => {
    const key = gameSessionStorageKeyForTests(OWNER);
    window.localStorage.setItem(key, '{broken');
    expect(readPersistedGameSession(OWNER)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();

    window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 99, gameType: 'memory' }));
    expect(readPersistedGameSession(OWNER)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('can clear only the expected active game without deleting a newer session', () => {
    persistGameSession(OWNER, {
      gameType: 'memory',
      dictionaryId: 'one',
      dictionaryWords: ['PANDA'],
      state: { moves: 2 },
      score: 2,
    });
    clearPersistedGameSession(OWNER, 'translation');
    expect(readPersistedGameSession(OWNER)?.gameType).toBe('memory');
    clearPersistedGameSession(OWNER, 'memory');
    expect(readPersistedGameSession(OWNER)).toBeNull();
  });
});
