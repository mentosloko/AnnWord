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
import { EnrichedWord, GameSettings, ViewState } from '../types';

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
    expect(createInitialGameState()).toMatchObject({
      secretWord: '',
      guesses: [],
      currentGuess: '',
      gameStatus: 'playing',
      rowIndex: 0,
      error: null,
    });
  });

  it('scores duplicate letters correctly and never downgrades correct keyboard statuses', () => {
    expect(getGuessLetterStatuses('ALLEY', 'APPLE')).toEqual(['correct', 'present', 'absent', 'present', 'absent']);

    const previous = getUpdatedKeyStatuses({}, 'PAPER', 'APPLE');
    expect(previous.P).toBe('correct');
    expect(previous.A).toBe('present');

    const next = getUpdatedKeyStatuses(previous, 'APPLE', 'APPLE');
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

  it('blocks game start when selected dictionary has no matching supported word length', () => {
    const { result, onRouteChange } = setupController({
      settings: { ...settings, wordLength: 6, dictionarySource: 'custom' },
      getSecretWordPool: () => words.filter(word => word.word.length !== 6),
    });

    act(() => result.current.startNewGame());

    expect(onRouteChange).not.toHaveBeenCalled();
    expect(result.current.setupError).toBe('В вашем словаре нет слов длиной 6.');
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

    act(() => {
      result.current.handleDelete();
      result.current.handleDelete();
      result.current.handleDelete();
    });
    typeWord(result, 'ZZZZZ');
    await act(async () => result.current.handleEnter());

    expect(result.current.gameState.error).toBe('Такого слова нет в словаре');
    expect(result.current.gameState.guesses).toEqual([]);
    expect(result.current.gameState.rowIndex).toBe(0);
    expect(onStatsUpdate).not.toHaveBeenCalled();
  });

  it('wins a classic game, clears current guess, records guess, updates keyboard, and reports stats', async () => {
    const { result, onStatsUpdate } = setupController();
    act(() => result.current.startNewGame());

    typeWord(result, 'APPLE');
    await act(async () => result.current.handleEnter());

    expect(result.current.gameState.gameStatus).toBe('won');
    expect(result.current.gameState.guesses).toEqual(['APPLE']);
    expect(result.current.gameState.currentGuess).toBe('');
    expect(result.current.gameState.rowIndex).toBe(1);
    expect(result.current.keyStatuses).toMatchObject({ A: 'correct', P: 'correct', L: 'correct', E: 'correct' });
    expect(onStatsUpdate).toHaveBeenCalledWith(true, 'APPLE');
  });

  it('loses after max valid attempts and reports a lost stat update once', async () => {
    const { result, onStatsUpdate } = setupController();
    act(() => result.current.startNewGame());

    const wrongValidWords = ['BERRY', 'MANGO', 'LEMON', 'PEACH', 'GRAPE', 'PLANT'].slice(0, MAX_GUESSES);
    for (const word of wrongValidWords) {
      typeWord(result, word);
      await act(async () => result.current.handleEnter());
    }

    expect(result.current.gameState.gameStatus).toBe('lost');
    expect(result.current.gameState.guesses).toEqual(wrongValidWords);
    expect(result.current.gameState.rowIndex).toBe(MAX_GUESSES);
    expect(onStatsUpdate).toHaveBeenCalledTimes(1);
    expect(onStatsUpdate).toHaveBeenCalledWith(false, 'APPLE');
  });

  it('ignores physical keyboard events outside the game route and accepts them inside the game route', async () => {
    const onStatsUpdate = vi.fn().mockResolvedValue(undefined);
    const onRouteChange = vi.fn();
    const args: Parameters<typeof useClassicGameController>[0] = {
      route: 'setup' as ViewState,
      settings,
      getSecretWordPool: () => words,
      getValidationPool: () => words.map(word => word.word),
      getModeWords: () => words.map(word => word.word),
      onRouteChange,
      onStatsUpdate,
    };

    const { result, rerender } = renderHook((props: Parameters<typeof useClassicGameController>[0]) => useClassicGameController(props), { initialProps: args });
    act(() => result.current.startNewGame());

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' })));
    expect(result.current.gameState.currentGuess).toBe('');

    act(() => {
      rerender({ ...args, route: 'game' });
    });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' })));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' })));

    expect(result.current.gameState.currentGuess).toBe('A');
  });
});
