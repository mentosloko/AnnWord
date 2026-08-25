import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DailyQuestCard } from '../components/DailyQuestCard';
import type { DailyQuestState } from '../types';

const quest: DailyQuestState = {
  questDate: '2026-08-25',
  kind: 'all_five_games',
  title: 'Большое приключение',
  description: 'За сегодня выполни пять игровых целей.',
  progressLabel: '2/5: Змейка, Память',
  completedModes: ['letter_square', 'memory'],
  completed: false,
};

describe('DailyQuestCard all-five progress', () => {
  afterEach(cleanup);

  it('renders server-returned per-mode progress instead of a random local checklist', () => {
    render(<DailyQuestCard quest={quest} />);
    const progress = screen.getByLabelText('Прогресс Большого приключения');
    expect(progress).toHaveTextContent('2/5');
    expect(progress).toHaveTextContent('✓Змейка · 6 слов');
    expect(progress).toHaveTextContent('✓Память · завершить');
    expect(progress).toHaveTextContent('○Спринт · 6 слов');
  });

  it('shows every step completed when server quest is completed', () => {
    render(<DailyQuestCard quest={{ ...quest, completed: true, completedModes: ['letter_square', 'hangman', 'memory', 'anagram', 'sprint'] }} />);
    const progress = screen.getByLabelText('Прогресс Большого приключения');
    expect(progress).toHaveTextContent('5/5');
    expect(progress.textContent?.match(/✓/g)?.length).toBe(5);
  });
});
