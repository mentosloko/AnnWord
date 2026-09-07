import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupScreen } from '../components/screens/SetupScreenSafe';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { isAllowedSecretWord } from '../services/dictionaryEngine';
import { resetDictionaryRuntimeForTests } from '../services/dictionaryRuntime';
import { ensureSpotlightDictionaryLoaded, getSpotlightEntries, getSpotlightGrades, getSpotlightSections, SPOTLIGHT_ALL_SECTIONS_ID, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from '../services/spotlightDictionary';
import type { GameSettings, UserProfile } from '../types';

const findGradeWithSections = (minimum: number) => {
  for (const grade of getSpotlightGrades()) {
    const sections = getSpotlightSections(grade).filter(section => section.wordCount > 0);
    if (sections.length >= minimum) return { grade, sections };
  }
  throw new Error(`Spotlight fixture needs at least ${minimum} populated sections in one grade.`);
};

const premiumProfile: UserProfile = {
  ...GUEST_PROFILE,
  username: 'Kid',
  accountMode: 'parent',
  role: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  featureFlags: { ...(GUEST_PROFILE.featureFlags || {}), premiumDictionaries: true },
};

describe('Spotlight multi-module setup flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDictionaryRuntimeForTests();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    resetDictionaryRuntimeForTests();
  });

  it('persists two module toggles and starts Sprint from their merged word pool', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const firstTwo = sections.slice(0, 2);
    const onCommit = vi.fn(async (_next: GameSettings) => undefined);
    const onStartGame = vi.fn(async (_words?: string[]) => undefined);

    const initialSettings: GameSettings = {
      username: 'Kid',
      wordLength: 5,
      difficulty: 'ALL',
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionId: SPOTLIGHT_ALL_SECTIONS_ID,
      activeSpotlightSectionIds: [SPOTLIGHT_ALL_SECTIONS_ID],
    };

    const Harness = () => {
      const [current, setCurrent] = React.useState(initialSettings);
      return <SetupScreen
        selectedPlayMode="sprint"
        settings={current}
        customDictionaryWords={[]}
        setupError={null}
        isUploadingDictionary={false}
        isAuthenticated
        userProfile={premiumProfile}
        onSettingsChange={setCurrent}
        onCommitDictionarySettings={async next => {
          onCommit(next);
          setCurrent(next);
        }}
        onFileUpload={vi.fn()}
        onOpenDictionaryStudio={vi.fn()}
        onOpenPremium={vi.fn()}
        onStartGame={onStartGame}
        onBack={vi.fn()}
        onLogin={vi.fn()}
      />;
    };

    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(firstTwo[0].label, 'i') })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstTwo[0].label, 'i') }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(firstTwo[0].label, 'i') })).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstTwo[1].label, 'i') }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: new RegExp(firstTwo[0].label, 'i') })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: new RegExp(firstTwo[1].label, 'i') })).toHaveAttribute('aria-pressed', 'true');
    });

    expect(onCommit.mock.calls[1][0]).toMatchObject({
      activeSpotlightGrade: grade,
      activeSpotlightSectionId: firstTwo[0].id,
      activeSpotlightSectionIds: [firstTwo[0].id, firstTwo[1].id],
    });

    const expectedWords = getSpotlightEntries(grade, firstTwo.map(section => section.id))
      .filter(entry => isAllowedSecretWord(entry.word))
      .map(entry => entry.word);
    expect(expectedWords.length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Начать: Спринт' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Начать: Спринт' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledTimes(1));
    expect(new Set(onStartGame.mock.calls[0][0])).toEqual(new Set(expectedWords));
  });
});
