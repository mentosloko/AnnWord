import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DictionarySettingsScreen } from '../components/screens/DictionarySettingsScreen';
import { ensureSpotlightDictionaryLoaded, getSpotlightGrades, getSpotlightSections, resetSpotlightDictionaryForTests, SPOTLIGHT_ALL_SECTIONS_ID, SPOTLIGHT_PREMIUM_DICTIONARY_ID } from '../services/spotlightDictionary';
import type { GameSettings, UserProfile } from '../types';

const settings: GameSettings = {
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Parent',
};

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  username: 'Parent',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  featureFlags: { adultRoom: true, premiumDictionaries: true },
  activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T10:00:00.000Z' },
  customDictionaryEn: ['PANDA', 'TIGER'],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Рэй', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [] },
  coins: 0,
  inventory: [],
  ...overrides,
});

const renderScreen = (props: Partial<React.ComponentProps<typeof DictionarySettingsScreen>> = {}) => {
  const onCommitSettings = vi.fn(async (_settings: GameSettings) => undefined);
  const onBack = vi.fn();
  const result = render(<DictionarySettingsScreen
    settings={settings}
    userProfile={profile()}
    customDictionaryWords={['PANDA', 'TIGER']}
    isAuthenticated
    onCommitSettings={onCommitSettings}
    onOpenDictionaryStudio={vi.fn()}
    onOpenPremium={vi.fn()}
    onBack={onBack}
    {...props}
  />);
  return { ...result, onCommitSettings, onBack };
};

const findGradeWithSections = (minimum: number) => {
  for (const grade of getSpotlightGrades()) {
    const sections = getSpotlightSections(grade).filter(section => section.wordCount > 0);
    if (sections.length >= minimum) return { grade, sections };
  }
  throw new Error(`Spotlight fixture needs at least ${minimum} populated sections in one grade.`);
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetSpotlightDictionaryForTests();
});

describe('DictionarySettingsScreen draft selection', () => {
  it('does not change the active source until Done is pressed', async () => {
    const { onCommitSettings, onBack } = renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Темы/ }));
    fireEvent.click(screen.getByRole('button', { name: /Животные/ }));

    expect(onCommitSettings).not.toHaveBeenCalled();
    expect(screen.getByText('Сохраните выбор, чтобы применить его к играм.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    await waitFor(() => expect(onCommitSettings).toHaveBeenCalledTimes(1));
    expect(onCommitSettings.mock.calls[0][0]).toMatchObject({
      dictionarySource: 'premium',
      activePremiumDictionaryId: 'kids_animals',
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps a custom draft through unrelated profile hydration', () => {
    const onCommitSettings = vi.fn(async (_settings: GameSettings) => undefined);
    const onBack = vi.fn();
    const { rerender } = render(<DictionarySettingsScreen
      settings={settings}
      userProfile={profile()}
      customDictionaryWords={['PANDA', 'TIGER']}
      isAuthenticated
      onCommitSettings={onCommitSettings}
      onOpenDictionaryStudio={vi.fn()}
      onOpenPremium={vi.fn()}
      onBack={onBack}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Мой словарь/ }));
    expect(screen.getByText('Сохраните выбор, чтобы применить его к играм.')).toBeInTheDocument();

    rerender(<DictionarySettingsScreen
      settings={settings}
      userProfile={profile({ coins: 17 })}
      customDictionaryWords={['PANDA', 'TIGER']}
      isAuthenticated
      onCommitSettings={onCommitSettings}
      onOpenDictionaryStudio={vi.fn()}
      onOpenPremium={vi.fn()}
      onBack={onBack}
    />);

    expect(screen.getAllByText('Ваш список').length).toBeGreaterThan(0);
    expect(screen.getByText('Сохраните выбор, чтобы применить его к играм.')).toBeInTheDocument();
    expect(onCommitSettings).not.toHaveBeenCalled();
  });

  it('selects and saves multiple Spotlight modules in one class without committing intermediate clicks', async () => {
    await ensureSpotlightDictionaryLoaded();
    const { grade, sections } = findGradeWithSections(2);
    const initialSettings: GameSettings = {
      ...settings,
      dictionarySource: 'premium',
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionId: SPOTLIGHT_ALL_SECTIONS_ID,
      activeSpotlightSectionIds: [SPOTLIGHT_ALL_SECTIONS_ID],
    };
    const activeProfile = profile({
      activeWordSource: {
        source: 'premium',
        difficulty: 'ALL',
        premiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
        spotlightGrade: grade,
        spotlightSectionId: SPOTLIGHT_ALL_SECTIONS_ID,
        spotlightSectionIds: [SPOTLIGHT_ALL_SECTIONS_ID],
      },
    });
    const { onCommitSettings } = renderScreen({ settings: initialSettings, userProfile: activeProfile });

    const first = screen.getByRole('button', { name: new RegExp(sections[0].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    const second = screen.getByRole('button', { name: new RegExp(sections[1].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    fireEvent.click(first);
    fireEvent.click(second);

    expect(onCommitSettings).not.toHaveBeenCalled();
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(sections[0].title, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(sections[1].title, { exact: false }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    await waitFor(() => expect(onCommitSettings).toHaveBeenCalledTimes(1));
    expect(onCommitSettings.mock.calls[0][0]).toMatchObject({
      dictionarySource: 'premium',
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionId: sections[0].id,
      activeSpotlightSectionIds: [sections[0].id, sections[1].id],
    });
  });
});
