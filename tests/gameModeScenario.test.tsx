import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from '../components/screens/ModeScreens';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const words = ['APPLE', 'BERRY', 'MANGO', 'LEMON', 'PEACH', 'GRAPE'];

const installStableRandom = () => {
  let i = 0;
  const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
  vi.spyOn(Math, 'random').mockImplementation(() => values[i++ % values.length]);
};

describe('game mode scenario contracts', () => {
  beforeEach(() => {
    installStableRandom();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders AnagramsScreen with a playable dictionary and parent back callback', () => {
    const onBackHome = vi.fn();

    render(<AnagramsScreen words={words} userProfile={GUEST_PROFILE} onWin={vi.fn()} onBackHome={onBackHome} />);

    expect(screen.getAllByText('Анаграммы').length).toBeGreaterThan(0);
    expect(screen.getByText('Перевод')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Меню/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Меню/i }));
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('renders SprintScreen with options and parent back callback', () => {
    const onBackHome = vi.fn();

    render(<SprintScreen words={words} userProfile={GUEST_PROFILE} onWin={vi.fn()} onBackHome={onBackHome} />);

    expect(screen.getByText('Спринт')).toBeInTheDocument();
    expect(screen.getByText('Как переводится?')).toBeInTheDocument();
    expect(screen.getByText(/60с/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Меню/i }));
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('renders MemoryScreen cards and parent back callback', () => {
    const onBackHome = vi.fn();

    render(<MemoryScreen words={words} userProfile={GUEST_PROFILE} onWin={vi.fn()} onBackHome={onBackHome} />);

    expect(screen.getByText('Память')).toBeInTheDocument();
    expect(screen.getByText('Мемо')).toBeInTheDocument();
    expect(screen.getByText(/Ходы: 0/)).toBeInTheDocument();
    expect(screen.getAllByText('?')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: /Меню/i }));
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('renders HangmanScreen with hearts, alphabet buttons, and parent back callback', () => {
    const onBackHome = vi.fn();

    render(<HangmanScreen words={words} userProfile={GUEST_PROFILE} onWin={vi.fn()} onBackHome={onBackHome} />);

    expect(screen.getByText('Виселица')).toBeInTheDocument();
    expect(screen.getByText('Угадай слово')).toBeInTheDocument();
    expect(screen.getByText(/Осталось попыток: 7/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Меню/i }));
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});
