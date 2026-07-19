import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { familyAccountService } from '../services/familyAccountService';
import { mentorRoomService } from '../services/mentorRoomService';
import type { UserProfile } from '../types';

vi.mock('../components/WeeklyReportSettingsCard', () => ({
  WeeklyReportSettingsCard: () => null,
}));

import { AdultRoomScreen } from '../components/screens/AdultRoomScreen';

const parentProfile: UserProfile = {
  username: 'parent@example.ru',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2027-01-01T00:00:00.000Z',
  childDisplayName: 'Катя',
  childShareCode: 'KATYA1',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Щенок', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [] },
  coins: 0,
  inventory: [],
};

const learner = {
  id: 'child-1',
  name: 'Катя',
  childShareCode: 'KATYA1',
  stats: { gamesPlayed: 4, gamesWon: 3, wordsGuessed: {} },
  assignedWords: [],
  weeklyAccuracy: 75,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdultRoomScreen parent unlock', () => {
  it('verifies the PIN and loads the child in one service call', async () => {
    const openAdultRoom = vi.spyOn(familyAccountService, 'openAdultRoom').mockResolvedValue({ learners: [learner], backendReady: true });
    const loadLearners = vi.spyOn(mentorRoomService, 'loadLearners').mockResolvedValue({ learners: [learner], backendReady: true });

    render(<AdultRoomScreen userProfile={parentProfile} onBackHome={() => undefined} onOpenDictionaryStudio={() => undefined} />);

    fireEvent.change(screen.getByLabelText('PIN родителя'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Открыть' }));

    await waitFor(() => expect(screen.getByText('Катя')).toBeInTheDocument());
    expect(openAdultRoom).toHaveBeenCalledOnce();
    expect(openAdultRoom).toHaveBeenCalledWith('1234');
    expect(loadLearners).not.toHaveBeenCalled();
  });
});
