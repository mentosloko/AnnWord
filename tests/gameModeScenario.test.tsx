import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const { createModeGameMock } = vi.hoisted(() => ({
  createModeGameMock: (testId: string, label: string) => {
    const MockModeGame = ({ userProfile, onGameReward, onBack }: any) => React.createElement(
      'div',
      { 'data-testid': testId },
      React.createElement('div', { 'data-testid': `${testId}-dictionary` }, userProfile.customDictionaryEn.join(',')),
      React.createElement('button', { type: 'button', onClick: () => onGameReward({ type: label }) }, `${label} reward`),
      React.createElement('button', { type: 'button', onClick: onBack }, `${label} back`),
    );
    return MockModeGame;
  },
}));

vi.mock('../components/AnagramGame', () => ({
  AnagramGame: createModeGameMock('anagram-game', 'anagram'),
}));

vi.mock('../components/SprintGame', () => ({
  SprintGame: createModeGameMock('sprint-game', 'sprint'),
}));

vi.mock('../components/MemoryGame', () => ({
  MemoryGame: createModeGameMock('memory-game', 'memory'),
}));

vi.mock('../components/HangmanGame', () => ({
  HangmanGame: createModeGameMock('hangman-game', 'hangman'),
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
    const onGameReward = vi.fn();

    render(<AnagramsScreen words={words} userProfile={GUEST_PROFILE} onGameReward={onGameReward} onBackHome={onBackHome} />);

    expect(screen.getAllByText('Анаграммы').length).toBeGreaterThan(0);
    expect(screen.getByTestId('anagram-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'anagram reward' }));
    fireEvent.click(screen.getByRole('button', { name: 'anagram back' }));

    expect(onGameReward).toHaveBeenCalledWith({ type: 'anagram' });
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('renders safely without userProfile fallback', () => {
    render(<SprintScreen words={words} onGameReward={vi.fn()} onBackHome={vi.fn()} />);

    expect(screen.getByText('Спринт')).toBeInTheDocument();
    expect(screen.getByTestId('sprint-game-dictionary')).toHaveTextContent(words.join(','));
  });

  it('wires SprintScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onGameReward = vi.fn();

    render(<SprintScreen words={words} userProfile={GUEST_PROFILE} onGameReward={onGameReward} onBackHome={onBackHome} />);

    expect(screen.getByText('Спринт')).toBeInTheDocument();
    expect(screen.getByTestId('sprint-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'sprint reward' }));
    fireEvent.click(screen.getByRole('button', { name: 'sprint back' }));

    expect(onGameReward).toHaveBeenCalledWith({ type: 'sprint' });
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('wires MemoryScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onGameReward = vi.fn();

    render(<MemoryScreen words={words} userProfile={GUEST_PROFILE} onGameReward={onGameReward} onBackHome={onBackHome} />);

    expect(screen.getByText('Память')).toBeInTheDocument();
    expect(screen.getByTestId('memory-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'memory reward' }));
    fireEvent.click(screen.getByRole('button', { name: 'memory back' }));

    expect(onGameReward).toHaveBeenCalledWith({ type: 'memory' });
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('wires HangmanScreen to the mini-game prop contract', () => {
    const onBackHome = vi.fn();
    const onGameReward = vi.fn();

    render(<HangmanScreen words={words} userProfile={GUEST_PROFILE} onGameReward={onGameReward} onBackHome={onBackHome} />);

    expect(screen.getByText('Виселица')).toBeInTheDocument();
    expect(screen.getByTestId('hangman-game-dictionary')).toHaveTextContent(words.join(','));

    fireEvent.click(screen.getByRole('button', { name: 'hangman reward' }));
    fireEvent.click(screen.getByRole('button', { name: 'hangman back' }));

    expect(onGameReward).toHaveBeenCalledWith({ type: 'hangman' });
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});