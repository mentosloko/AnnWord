import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const makeModeGameMock = async (testId: string, label: string) => {
  const ReactModule = await import('react');
  return ({ userProfile, onWinCoins, onAddXP, onBack }: any) => ReactModule.createElement(
    'div',
    { 'data-testid': testId },
    ReactModule.createElement('div', { 'data-testid': `${testId}-dictionary` }, userProfile.customDictionaryEn.join(',')),
    ReactModule.createElement('button', { type: 'button', onClick: () => onWinCoins(7) }, `${label} win`),
    ReactModule.createElement('button', { type: 'button', onClick: () => onAddXP(3) }, `${label} xp`),
    ReactModule.createElement('button', { type: 'button', onClick: onBack }, `${label} back`),
  );
};

vi.mock('../components/AnagramGame', async () => ({
  AnagramGame: await makeModeGameMock('anagram-game', 'anagram'),
}));

vi.mock('../components/SprintGame', async () => ({
  SprintGame: await makeModeGameMock('sprint-game', 'sprint'),
}));

vi.mock('../components/MemoryGame', async () => ({
  MemoryGame: await makeModeGameMock('memory-game', 'memory'),
}));

vi.mock('../components/HangmanGame', async () => ({
  HangmanGame: await makeModeGameMock('hangman-game', 'hangman'),
}));

import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from '../components/screens/ModeScreens';

const words = ['APPLE', 'BERRY', 'MANGO', 'LEMON', 'PEACH', 'GRAPE'];

describe('game mode scenario contracts', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('wires AnagramsScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onWin = vi.fn();

    render(<AnagramsScreen words={words} userProfile={GUEST_PROFILE} onWin={onWin} onBackHome={onBackHome} />);

    expect(screen.getAllByText('Анаграммы').length).toBeGreaterThan(0);
    expect(screen.getByTestId('anagram-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'anagram win' }));
    fireEvent.click(screen.getByRole('button', { name: 'anagram back' }));

    expect(onWin).toHaveBeenCalledWith(7);
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('wires SprintScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onWin = vi.fn();

    render(<SprintScreen words={words} userProfile={GUEST_PROFILE} onWin={onWin} onBackHome={onBackHome} />);

    expect(screen.getByText('Спринт')).toBeInTheDocument();
    expect(screen.getByTestId('sprint-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'sprint win' }));
    fireEvent.click(screen.getByRole('button', { name: 'sprint back' }));

    expect(onWin).toHaveBeenCalledWith(7);
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('wires MemoryScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onWin = vi.fn();

    render(<MemoryScreen words={words} userProfile={GUEST_PROFILE} onWin={onWin} onBackHome={onBackHome} />);

    expect(screen.getByText('Память')).toBeInTheDocument();
    expect(screen.getByTestId('memory-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'memory win' }));
    fireEvent.click(screen.getByRole('button', { name: 'memory back' }));

    expect(onWin).toHaveBeenCalledWith(7);
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('wires HangmanScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onWin = vi.fn();

    render(<HangmanScreen words={words} userProfile={GUEST_PROFILE} onWin={onWin} onBackHome={onBackHome} />);

    expect(screen.getByText('Виселица')).toBeInTheDocument();
    expect(screen.getByTestId('hangman-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'hangman win' }));
    fireEvent.click(screen.getByRole('button', { name: 'hangman back' }));

    expect(onWin).toHaveBeenCalledWith(7);
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});
