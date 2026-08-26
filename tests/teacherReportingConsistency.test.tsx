import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '../components/screens/ProfileScreen';
import { ReviewWordList } from '../components/ReviewWordList';
import { mentorRoomService, normalizeMentorRoomResult } from '../services/mentorRoomService';
import { getLearnerProgressMetrics, getTeacherLearnerSummary } from '../services/teacherLearnerSummary';
import { wordTranslationService } from '../services/wordTranslationService';
import type { UserProfile } from '../types';

const teacherProfile: UserProfile = {
  username: 'Teacher',
  role: 'teacher',
  accountMode: 'teacher',
  subscriptionTier: 'free',
  customDictionaryEn: [],
  dictionaryCollections: [{ id: 'c1', title: 'Animals', source: 'manual', words: ['PANDA', 'TIGER', 'ZEBRA'] }],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: '', type: '', level: 1, mood: 'neutral', xp: 0, equippedAccessories: [], characterOnboarded: false },
  coins: 0,
  inventory: [],
};

const backendLearner = {
  id: 'child-1',
  name: 'Аня',
  stats: {
    gamesPlayed: 7,
    gamesWon: 5,
    wordsGuessed: { PANDA: 2, TIGER: 1 },
    wordPerformance: {
      PANDA: { word: 'PANDA', attempts: 3, correct: 3, mistakes: 0 },
      TIGER: { word: 'TIGER', attempts: 2, correct: 1, mistakes: 1 },
    },
  },
  assignedWords: ['PANDA', 'TIGER'],
};

describe('teacher reporting consistency', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uses the normalized learner stats for both learner metrics and teacher totals', () => {
    const result = normalizeMentorRoomResult({ learners: [backendLearner], backendReady: true });
    const learner = result.learners[0];
    const cardMetrics = getLearnerProgressMetrics(learner);
    const overview = getTeacherLearnerSummary(result.learners);

    expect(cardMetrics.gamesPlayed).toBe(7);
    expect(cardMetrics.gamesWon).toBe(5);
    expect(cardMetrics.encounteredWords).toBe(2);
    expect(cardMetrics.errorWords).toBe(1);
    expect(overview.gamesPlayed).toBe(cardMetrics.gamesPlayed);
    expect(overview.gamesWon).toBe(cardMetrics.gamesWon);
    expect(overview.encounteredWords).toBe(cardMetrics.encounteredWords);
    expect(overview.errorWords).toBe(cardMetrics.errorWords);
    expect(overview.learners).toBe(1);
    expect(overview.accuracy).toBe(71);
  });

  it('teacher summary renders learner totals instead of zero teacher-game stats', async () => {
    const result = normalizeMentorRoomResult({ learners: [backendLearner], backendReady: true });
    vi.spyOn(mentorRoomService, 'loadLearners').mockResolvedValue(result);

    render(<ProfileScreen userProfile={teacherProfile} isAuthenticated onBackHome={vi.fn()} onOpenShop={vi.fn()} onOpenPetRoom={vi.fn()} onLogin={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Ученики · общая сводка')).toBeVisible());
    await waitFor(() => expect(screen.getByText('71%')).toBeVisible());
    expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
    expect(screen.getByText('управление данными аккаунта', { exact: false })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Запросить экспорт данных' })).toHaveAttribute('href', expect.stringContaining('mailto:support@annword.ru'));
    expect(screen.getByRole('link', { name: 'Запросить удаление аккаунта' })).toHaveAttribute('href', expect.stringContaining('mailto:support@annword.ru'));
  });

  it('review words really open a translation instead of only promising one', async () => {
    vi.spyOn(wordTranslationService, 'get').mockResolvedValue('тигр');
    render(<ReviewWordList words={['TIGER']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Показать перевод слова TIGER' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());
    expect(screen.getByText('тигр')).toBeVisible();
  });
});
