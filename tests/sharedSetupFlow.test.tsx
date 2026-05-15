import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppScreens, ClassicGameScreenBindings } from '../components/AppScreens';
import { GameSettings, GameState, UserProfile } from '../types';

const profile: UserProfile = {
  username: 'Tester',
  customDictionaryEn: ['APPLE', 'BERRY'],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Owl',
    type: 'Owl',
    level: 1,
    mood: 'happy',
    xp: 0,
    hunger: 80,
    energy: 80,
    equippedAccessories: [],
  },
  coins: 0,
  inventory: [],
};

const settings: GameSettings = {
  username: 'Tester',
  difficulty: 'ALL',
  wordLength: 5,
  dictionarySource: 'builtin',
  useCustomDictionary: false,
};

const gameState: GameState = {
  secretWord: '',
  guesses: [],
  history: [],
  currentGuess: '',
  gameStatus: 'playing',
  rowIndex: 0,
  hint: null,
  loadingHint: false,
  error: null,
};

const classicGame: ClassicGameScreenBindings = {
  setupError: null,
  gameState,
  keyStatuses: {},
  shakeRowIndex: null,
  startNewGame: vi.fn(),
  handleChar: vi.fn(),
  handleDelete: vi.fn(),
  handleEnter: vi.fn(),
  fetchHint: vi.fn(),
};

const renderScreens = (overrides: Partial<React.ComponentProps<typeof AppScreens>> = {}) => {
  const onRouteChange = vi.fn();
  const onSelectedPlayModeChange = vi.fn();
  const props: React.ComponentProps<typeof AppScreens> = {
    route: 'landing',
    selectedPlayMode: 'game',
    userProfile: profile,
    isAuthenticated: true,
    settings,
    modeWords: ['APPLE', 'BERRY'],
    classicGame,
    dictionaryUpload: {
      isUploadingDictionary: false,
      error: null,
      onFileUpload: vi.fn(),
    },
    onRouteChange,
    onSelectedPlayModeChange,
    onSettingsChange: vi.fn(),
    onOpenLogin: vi.fn(),
    onOpenRules: vi.fn(),
    onBuy: vi.fn().mockResolvedValue(undefined),
    onUseItem: vi.fn().mockResolvedValue(undefined),
    onWinCoins: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(<AppScreens {...props} />);
  return { props, onRouteChange, onSelectedPlayModeChange };
};

describe('shared setup flow for all game modes', () => {
  it('routes Memory from landing through setup instead of opening the game directly', () => {
    const { onRouteChange, onSelectedPlayModeChange } = renderScreens();

    fireEvent.click(screen.getByRole('button', { name: /Память/i }));

    expect(onSelectedPlayModeChange).toHaveBeenCalledWith('memory');
    expect(onRouteChange).toHaveBeenCalledWith('setup');
    expect(onRouteChange).not.toHaveBeenCalledWith('memory');
  });

  it('starts selected mini-game from setup with current dictionary settings', () => {
    const { onRouteChange } = renderScreens({ route: 'setup', selectedPlayMode: 'sprint' });

    expect(screen.getByText('Режим: Спринт')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Играть: Спринт' }));

    expect(onRouteChange).toHaveBeenCalledWith('sprint');
  });

  it('keeps Wordle start using the classic game initializer', () => {
    const startNewGame = vi.fn();
    renderScreens({
      route: 'setup',
      selectedPlayMode: 'game',
      classicGame: { ...classicGame, startNewGame },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Играть: Wordle' }));

    expect(startNewGame).toHaveBeenCalledTimes(1);
  });
});
