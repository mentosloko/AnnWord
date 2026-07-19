import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mentorRoomService } from '../services/mentorRoomService';
import type { UserProfile } from '../types';

vi.mock('../components/WeeklyReportSettingsCard', () => ({
  WeeklyReportSettingsCard: () => null,
}));

import { AdultRoomScreen } from '../components/screens/AdultRoomScreen';

const teacherProfile: UserProfile = {
  username: 'teacher@example.ru',
  role: 'teacher',
  accountMode: 'teacher',
  subscriptionTier: 'free',
  customDictionaryEn: [],
  dictionaryCollections: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Щенок', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [] },
  coins: 0,
  inventory: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdultRoomScreen loading state', () => {
  it('does not claim that a learner is missing before the request completes', async () => {
    let resolveLoad!: (value: { learners: []; backendReady: true }) => void;
    const pending = new Promise<{ learners: []; backendReady: true }>(resolve => { resolveLoad = resolve; });
    vi.spyOn(mentorRoomService, 'loadLearners').mockReturnValue(pending);

    render(<AdultRoomScreen userProfile={teacherProfile} onBackHome={() => undefined} onOpenDictionaryStudio={() => undefined} />);

    expect(await screen.findAllByText(/Загружаю/)).not.toHaveLength(0);
    expect(screen.queryByText('Пока нет подключённых учеников.')).not.toBeInTheDocument();
    expect(screen.queryByText('Подключите ученика по коду, чтобы видеть прогресс.')).not.toBeInTheDocument();

    await act(async () => { resolveLoad({ learners: [], backendReady: true }); });

    await waitFor(() => expect(screen.getByText('Пока нет подключённых учеников.')).toBeInTheDocument());
    expect(screen.getByText('Подключите ученика по коду, чтобы видеть прогресс.')).toBeInTheDocument();
  });

  it('shows an error instead of a confirmed empty state when loading fails', async () => {
    vi.spyOn(mentorRoomService, 'loadLearners').mockRejectedValue(new Error('Сервер временно недоступен.'));

    render(<AdultRoomScreen userProfile={teacherProfile} onBackHome={() => undefined} onOpenDictionaryStudio={() => undefined} />);

    expect(await screen.findByText('Сервер временно недоступен.')).toBeInTheDocument();
    expect(screen.queryByText('Пока нет подключённых учеников.')).not.toBeInTheDocument();
    expect(screen.queryByText('Подключите ученика по коду, чтобы видеть прогресс.')).not.toBeInTheDocument();
    expect(screen.getByText('Данные не загружены. Нажмите «Повторить» выше.')).toBeInTheDocument();
  });
});
