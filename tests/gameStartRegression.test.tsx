import React from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupScreen } from '../components/screens/SetupScreen';
import { useClassicGameController } from '../hooks/useClassicGameController';
import { GameSettings, UserProfile } from '../types';

const dictionaryRuntimeMock = vi.hoisted(() => ({
  ensureReady: vi.fn(() => new Promise<void>(() => undefined)),
  getModeWords: vi.fn(() => ['APPLE']),
}));

vi.mock('../hooks/useDictionaryPools', () => ({
  useDictionaryPools: () => ({
    status: 'loading',
    error: null,
    ensureReady: dictionaryRuntimeMock.ensureReady,
    getModeWords: dictionaryRuntimeMock.getModeWords,
  }),
}));

const settings: GameSettings = {
  username: 'anna.a.manto',
  wordLength: 5,
  difficulty: 'ALL',
  dictionarySource: 'builtin',
  useCustomDictionary: false,
};

const parentProfile: UserProfile = {
  username: 'anna.a.manto',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'free',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Щенок', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [], characterOnboarded: true },
  coins: 0,
  inventory: [],
};

const setupProps = {
  selectedPlayMode: 'game' as const,
  setupError: null,
  isUploadingDictionary: false,
  isAuthenticated: true,
  onFileUpload: vi.fn(),
  onCommitDictionarySettings: vi.fn().mockResolvedValue(undefined),
  onOpenDictionaryStudio: vi.fn(),
  onOpenPremium: vi.fn(),
  onBack: vi.fn(),
  onLogin: vi.fn(),
};

describe('game start regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProps.onCommitDictionarySettings.mockResolvedValue(undefined);
    dictionaryRuntimeMock.getModeWords.mockReturnValue(['APPLE']);
    dictionaryRuntimeMock.ensureReady.mockImplementation(() => new Promise<void>(() => undefined));
  });

  it('does not keep a kids quick start waiting for the general dictionary chunk', async () => {
    const onStartGame = vi.fn().mockResolvedValue(undefined);
    const onAutoStartComplete = vi.fn();

    render(
      <SetupScreen
        {...setupProps}
        settings={settings}
        customDictionaryWords={[]}
        userProfile={parentProfile}
        onSettingsChange={vi.fn()}
        onStartGame={onStartGame}
        autoStart
        onAutoStartComplete={onAutoStartComplete}
      />,
    );

    await waitFor(() => expect(onStartGame).toHaveBeenCalledWith(['APPLE']));
    await waitFor(() => expect(onAutoStartComplete).toHaveBeenCalledTimes(1));
    expect(dictionaryRuntimeMock.ensureReady).toHaveBeenCalled();
  });

  it('does not silently overwrite the canonical source when saved Premium access has expired', async () => {
    const onStartGame = vi.fn().mockResolvedValue(undefined);
    const onSettingsChange = vi.fn();
    const onAutoStartComplete = vi.fn();
    const expiredProfile: UserProfile = {
      ...parentProfile,
      subscriptionTier: 'premium',
      premiumExpiresAt: '2000-01-01T00:00:00.000Z',
      featureFlags: { premiumDictionaries: true },
      customDictionaryEn: ['APPLE'],
    };

    render(
      <SetupScreen
        {...setupProps}
        settings={{ ...settings, dictionarySource: 'custom', useCustomDictionary: true }}
        customDictionaryWords={['APPLE']}
        userProfile={expiredProfile}
        onSettingsChange={onSettingsChange}
        onStartGame={onStartGame}
        autoStart
        onAutoStartComplete={onAutoStartComplete}
      />,
    );

    await waitFor(() => expect(onAutoStartComplete).toHaveBeenCalledTimes(1));
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(setupProps.onCommitDictionarySettings).not.toHaveBeenCalled();
    expect(onStartGame).not.toHaveBeenCalled();
    expect(screen.getByText(/В выбранном списке пока нет слов/i)).toBeInTheDocument();
  });

  it('starts Classic from the prepared snapshot even when saved settings point to another length', () => {
    const onRouteChange = vi.fn();
    const words = [
      { word: 'APPLE', translation: 'яблоко', level: 'A1' },
      { word: 'BERRY', translation: 'ягода', level: 'A1' },
    ];
    const { result } = renderHook(() => useClassicGameController({
      route: 'setup',
      settings: { ...settings, wordLength: 4 },
      getSecretWordPool: () => words,
      getValidationPool: () => words.map(item => item.word),
      getModeWords: () => words.map(item => item.word),
      onRouteChange,
      onStatsUpdate: vi.fn().mockResolvedValue(undefined),
    }));

    act(() => result.current.startNewGame(['BERRY']));

    expect(result.current.setupError).toBeNull();
    expect(result.current.gameState.secretWord).toBe('BERRY');
    expect(onRouteChange).toHaveBeenCalledWith('game');
  });

  it('keeps the manual start button available when kids words are already in memory', () => {
    render(
      <SetupScreen
        {...setupProps}
        settings={settings}
        customDictionaryWords={[]}
        userProfile={parentProfile}
        onSettingsChange={vi.fn()}
        onStartGame={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Начать: Классика' })).toBeEnabled();
  });
});
