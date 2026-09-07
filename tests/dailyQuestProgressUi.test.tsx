import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyQuestCard, DailyQuestRewardModal } from '../components/DailyQuestCard';
import { getWorld } from '../services/premiumFeatureCatalog';
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
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders server-returned per-mode progress instead of a random local checklist', () => {
    render(<DailyQuestCard quest={quest} />);
    const progress = screen.getByLabelText('Прогресс Большого приключения');
    expect(progress).toHaveTextContent('2/5');
    expect(progress).toHaveTextContent('✓Змейка · 6 слов');
    expect(progress).toHaveTextContent('✓Память · завершить');
    expect(progress).toHaveTextContent('○Спринт · 6 слов');
    expect(progress).toHaveTextContent('○Анаграммы · 5 слов');
  });

  it('shows every step completed when server quest is completed', () => {
    render(<DailyQuestCard quest={{ ...quest, completed: true, completedModes: ['letter_square', 'hangman', 'memory', 'anagram', 'sprint'] }} />);
    const progress = screen.getByLabelText('Прогресс Большого приключения');
    expect(progress).toHaveTextContent('5/5');
    expect(progress.textContent?.match(/✓/g)?.length).toBe(5);
  });

  it('chooses a responsive daily-world asset without changing the full-size source', () => {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('devicePixelRatio', 2);
    expect(getWorld('theatre').backgroundImageUrl).toBe('/assets/rooms/daily/theatre-960.webp');

    vi.stubGlobal('devicePixelRatio', 3);
    expect(getWorld('theatre').backgroundImageUrl).toBe('/assets/rooms/daily/theatre-1440.webp');

    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('devicePixelRatio', 2);
    expect(getWorld('theatre').backgroundImageUrl).toBe('/assets/rooms/daily/theatre.webp');
    expect(getWorld('default_room').backgroundImageUrl).toBe('/assets/rooms/puppy/background.webp');
  });

  it('prefetches the same responsive daily world that the pet room will use', () => {
    const created: MockImage[] = [];
    class MockImage {
      decoding = '';
      fetchPriority = '';
      src = '';
      decode = vi.fn(() => Promise.resolve());
      constructor() { created.push(this); }
    }
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('devicePixelRatio', 2);
    vi.stubGlobal('Image', MockImage);

    render(<DailyQuestRewardModal reward={{ quest: { ...quest, completed: true }, worldId: 'theatre' }} onClose={() => undefined} />);

    expect(created).toHaveLength(1);
    expect(created[0].src).toBe('/assets/rooms/daily/theatre-960.webp');
    expect(created[0].decoding).toBe('async');
    expect(created[0].fetchPriority).toBe('high');
    expect(created[0].decode).toHaveBeenCalledTimes(1);
  });
});
