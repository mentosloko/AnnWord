import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SprintScreen } from '../components/screens/ModeScreens';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const words = ['APPLE', 'WATER', 'HOUSE', 'BABY'];
const viewerKey = 'sprint-first-run-test';
const storageKey = `annword:game-intro:v1:${viewerKey}:sprint`;

describe('Sprint first-run timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.removeItem(storageKey);
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    window.localStorage.removeItem(storageKey);
  });

  it('keeps all 60 seconds while rules block answers and starts only after explicit start', () => {
    render(<SprintScreen words={words} rulesViewerKey={viewerKey} userProfile={GUEST_PROFILE} onGameReward={vi.fn()} onBackHome={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /Как играть в «Спринт»/ })).toBeInTheDocument();
    expect(screen.getByText('60с')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText('60с')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Начать игру' }));
    act(() => { vi.advanceTimersByTime(1_050); });
    expect(screen.getByText('59с')).toBeInTheDocument();
  });
});
