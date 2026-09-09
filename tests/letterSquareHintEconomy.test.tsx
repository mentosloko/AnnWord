import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LetterSquareGameV3 } from '../components/LetterSquareGameV3';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const kidsProfile = {
  ...GUEST_PROFILE,
  role: 'parent' as const,
  accountMode: 'parent' as const,
  customDictionaryEn: ['BALL'],
  coins: 1,
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Snake first-letter hint economy', () => {
  // Snake follows the same one-coin paid-hint contract as the other Kids games.
  it('reveals the hint only after a successful one-coin charge', async () => {
    const onHintCharge = vi.fn().mockResolvedValue(true);
    render(
      <LetterSquareGameV3
        userProfile={kidsProfile}
        sessionOwnerId="snake-hint-success"
        onHintCharge={onHintCharge}
        onGameReward={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /Первая буква/ });
    expect(button.textContent).toContain('🪙1');
    fireEvent.click(button);

    await waitFor(() => expect(onHintCharge).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Подсказка: первая буква —/)).toBeTruthy());
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('does not reveal the first letter when the child has no coin to spend', async () => {
    const onHintCharge = vi.fn().mockResolvedValue(false);
    render(
      <LetterSquareGameV3
        userProfile={{ ...kidsProfile, coins: 0 }}
        sessionOwnerId="snake-hint-insufficient"
        onHintCharge={onHintCharge}
        onGameReward={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Первая буква/ }));

    await waitFor(() => expect(onHintCharge).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Для подсказки нужна 1 монета.')).toBeTruthy());
    expect(screen.queryByText(/Подсказка: первая буква —/)).toBeNull();
  });
});