import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_GUESSES } from '../constants';
import {
  createInitialGameState,
  getGuessLetterStatuses,
  getUpdatedKeyStatuses,
  useClassicGameController,
} from '../hooks/useClassicGameController';
import { EnrichedWord, GameSettings } from '../types';

const settings: GameSettings = {
  username: 'Tester',
  wordLength: 5,
  difficulty: 'A1',
  dictionarySource: 'builtin',
  useCustomDictionary: false,
};

const words: EnrichedWord[] = [
  { word: 'APPLE', translation: 'яблоко', level: 'A1' },
  { word: 'BERRY', translation: 'ягода', level: 'A1' },
  { word: 'MANGO', translation: 'манго', level: 'A1' },
  { word: 'LEMON', translation: 'лимон', level: 'A1' },
  { word: 'PEACH', translation: 'персик', level: 'A1' },
  { word: 'GRAPE', translation: 'виноград', level: 'A1' },
  { word: 'PLANT', translation: 'растение', level: 'A1' },
];

const typeWord = (result: ReturnType<typeof renderHook<ReturnType<typeof useClassicGameController>, Parameters<typeof useClassicGameController>[0]>>['result'], word: string) => {
  act(() => {
    for (const char of word) result.current.handleChar(char);
  });
};

const setupController = (overrides: Partial<Parameters<typeof useClassicGameController>[0]> = {}) => {
  const onRouteChange = vi.fn();
  const onStatsUpdate = vi.fn().mockResolvedValue(undefined);
  const args: Parameters<typeof useClassicGameController>[0] = {
    route: 'setup',
    settings,
    getSecretWordPool: () => words,
    getValidationPool: () => words.map(word => word.word),
    getModeWords: () => words.map(word => word.word),
    onRouteChange,
    onStatsUpdate,
    ...overrides,
  };

  const hook = renderHook((props: Parameters<typeof useClassicGameController>[0]) => useClassicGameController(props), {
    initialProps: args,
  });

  return { ...hook, onRouteChange, onStatsUpdate };
};

describe('classic game scenarios', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('creates a safe empty initial game state', () => {
    expect(createInitialGameState()).toMatchObject({ secretWord: '', guesses: [], currentGuess: '', gameStatus: 'playing', rowIndex: 0, error: null });
  });

  it('scores duplicate letters correctly and never downgrades correct keyboard statuses', () => {
    expect(getGuessLetterStatuses('ALLEY', 'APPLE')).toEqual(['correct', 'present', 'absent', 'present', 'absent']);
    const previous = getUpdatedKeyStatuses({}, 'PAPER', 'APPLE');
    const next = getUpdatedKeyStatuses(previous, 'APPLE', 'APPLE');
    expect(previous.P).toBe('correct');
    expect(previous.A).toBe('present');
    expect(next.A).toBe('correct');
    expect(next.P).toBe('correct');
    expect(next.L).toBe('correct');
    expect(next.E).toBe('correct');
  });

  it('starts a classic game from setup with a deterministic secret word', () => {
    const { result, onRouteChange } = setupController();
    act(() => result.current.startNewGame());
    expect(onRouteChange).toHaveBeenCalledWith('game');
    expect(result.current.setupError).toBeNull();
    expect(result.current.gameState.secretWord).toBe('APPLE');
    expect(result.current.gameState.secretWordData?.translation).toBe('яблоко');
    expect(result.current.keyStatuses).toEqual({});
  });

  it('starts custom dictionary game using a supported available word length', () => {
    const { result, onRouteChange } = setupController({
      settings: { ...settings, wordLength: 6, dictionarySource: 'custom' },
      getSecretWordPool: () => words.filter(word => word.word.length !== 6),
    });
    act(() => result.current.startNewGame());
    expect(onRouteChange).toHaveBeenCalledWith('game');
    expect(result.current.setupError).toBeNull();
    expect(result.current.gameState.secretWord.length).toBe(5);
  });

  it('validates short guesses and unknown dictionary words without consuming attempts', async () => {
    const { result, onStatsUpdate } = setupController();
    act(() => result.current.startNewGame());
    typeWord(result, 'APP');
    await act(async () => result.current.handleEnter());
    expect(result.current.gameState.error).toBe('Недостаточно букв');
    expect(result.current.gameState.guesses).toEqual([]);
    expect(result.current.gameState.rowIndex).toBe(0);
    expect(onStatsUpdate).not.toHaveBeenCalled();
    act(() => { result.current.handleDelete(); result.current.handleDelete(); result.current.handleDelete(); });
    typeWord(result, 'ZZZZZ');
    await act(async () => result.current.handleEnter());
    expect(result.current.gameState.error).toBe('Такого слова нет в словаре');
    expect(result.current.gameState.guesses).toEqual([]);
    expect(result.current.gameState.rowIndex).toBe(0);
    expect(onStatsUpdate).not.toHaveBeenCalled();
  });

  it('tracks win and loss statistics exactly once at terminal states', async () => {
    const { result, onStatsUpdate } = setupController();
    act(() => result.current.startNewGame());
    typeWord(result, 'APPLE');
    await act(async () => result.current.handleEnter());
    expect(result.current.gameState.gameStatus).toBe('won');
    expect(onStatsUpdate).toHaveBeenCalledWith(true, 'APPLE');
    const losing = setupController();
    act(() => losing.result.current.startNewGame());
    for (let attempt = 0; attempt < MAX_GUESSES; attempt += 1) {
      typeWord(losing.result, words[attempt + 1].word);
      await act(async () => losing.result.current.handleEnter());
    }
    expect(losing.result.current.gameState.gameStatus).toBe('lost');
    expect(losing.onStatsUpdate).toHaveBeenCalledWith(false, 'APPLE');
  });
});
