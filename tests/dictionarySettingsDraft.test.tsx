import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DictionarySettingsScreen } from '../components/screens/DictionarySettingsScreen';
import type { GameSettings, UserProfile } from '../types';

const settings: GameSettings = {
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Parent',
};

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  username: 'Parent',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T10:00:00.000Z' },
  customDictionaryEn: ['PANDA', 'TIGER'],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Рэй', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [] },
  coins: 0,
  inventory: [],
  ...overrides,
});

const renderScreen = (props: Partial<React.ComponentProps<typeof DictionarySettingsScreen>> = {}) => {
  const onCommitSettings = vi.fn(async (_settings: GameSettings) => undefined);
  const onBack = vi.fn();
  const result = render(<DictionarySettingsScreen
    settings={settings}
    userProfile={profile()}
    customDictionaryWords={['PANDA', 'TIGER']}
    isAuthenticated
    onCommitSettings={onCommitSettings}
    onOpenDictionaryStudio={vi.fn()}
    onOpenPremium={vi.fn()}
    onBack={onBack}
    {...props}
  />);
  return { ...result, onCommitSettings, onBack };
};

describe('DictionarySettingsScreen draft selection', () => {
  it('does not change the active source until Done is pressed', async () => {
    const { onCommitSettings, onBack } = renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Тематический/ }));
    fireEvent.click(screen.getByRole('button', { name: /Животные/ }));

    expect(onCommitSettings).not.toHaveBeenCalled();
    expect(screen.getByText('Изменения ещё не влияют на игры.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    await waitFor(() => expect(onCommitSettings).toHaveBeenCalledTimes(1));
    expect(onCommitSettings.mock.calls[0][0]).toMatchObject({
      dictionarySource: 'premium',
      activePremiumDictionaryId: 'kids_animals',
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps a custom draft through unrelated profile hydration', () => {
    const onCommitSettings = vi.fn(async (_settings: GameSettings) => undefined);
    const onBack = vi.fn();
    const { rerender } = render(<DictionarySettingsScreen
      settings={settings}
      userProfile={profile()}
      customDictionaryWords={['PANDA', 'TIGER']}
      isAuthenticated
      onCommitSettings={onCommitSettings}
      onOpenDictionaryStudio={vi.fn()}
      onOpenPremium={vi.fn()}
      onBack={onBack}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Свой/ }));
    expect(screen.getByText('Изменения ещё не влияют на игры.')).toBeInTheDocument();

    rerender(<DictionarySettingsScreen
      settings={settings}
      userProfile={profile({ coins: 17 })}
      customDictionaryWords={['PANDA', 'TIGER']}
      isAuthenticated
      onCommitSettings={onCommitSettings}
      onOpenDictionaryStudio={vi.fn()}
      onOpenPremium={vi.fn()}
      onBack={onBack}
    />);

    expect(screen.getByText('Ваш список')).toBeInTheDocument();
    expect(onCommitSettings).not.toHaveBeenCalled();
  });
});
