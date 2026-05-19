import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LandingScreen } from '../components/screens/LandingScreen';
import { SetupScreen } from '../components/screens/SetupScreen';
import { Shop } from '../components/Shop';
import { PetRoom } from '../components/PetRoom';
import { PetWidget } from '../components/PetWidget';
import { GameSettings, UserProfile } from '../types';

const profile: UserProfile = {
  username: 'Tester',
  customDictionaryEn: ['APPLE'],
  stats: { gamesPlayed: 1, gamesWon: 1, wordsGuessed: { APPLE: 1 } },
  pet: {
    name: 'Бадди',
    type: 'Puppy',
    level: 2,
    mood: 'happy',
    xp: 10,
    moodScore: 60,
    stage: 'stage_1',
    characterOnboarded: true,
    hunger: 60,
    energy: 60,
    equippedAccessories: [],
  },
  coins: 100,
  inventory: [
    { id: 'apple', type: 'food', name: 'Apple', quantity: 1 },
    { id: 'hat', type: 'accessory', name: 'Hat', quantity: 1 },
  ],
};

const settings: GameSettings = {
  username: 'Tester',
  difficulty: 'ALL',
  wordLength: 5,
  dictionarySource: 'builtin',
  useCustomDictionary: false,
};

describe('component contracts', () => {
  it('LandingScreen routes through callback props', () => {
    const onStartClassic = vi.fn();
    const onStartAnagrams = vi.fn();
    const onStartSprint = vi.fn();
    const onStartHangman = vi.fn();
    const onStartMemory = vi.fn();
    const onOpenShop = vi.fn();
    const onOpenProfile = vi.fn();
    const onOpenPetRoom = vi.fn();

    render(
      <LandingScreen
        userProfile={profile}
        isAuthenticated
        onStartClassic={onStartClassic}
        onStartAnagrams={onStartAnagrams}
        onStartSprint={onStartSprint}
        onStartHangman={onStartHangman}
        onStartMemory={onStartMemory}
        onOpenShop={onOpenShop}
        onOpenRules={vi.fn()}
        onOpenLogin={vi.fn()}
        onOpenProfile={onOpenProfile}
        onOpenPetRoom={onOpenPetRoom}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Играть: Классика' }));
    fireEvent.click(screen.getByRole('button', { name: 'Играть: Анаграммы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Играть: Спринт' }));
    fireEvent.click(screen.getByRole('button', { name: 'Играть: Виселица' }));
    fireEvent.click(screen.getByRole('button', { name: 'Играть: Память' }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть магазин' }));
    fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
    fireEvent.click(screen.getByTitle('Открыть комнату персонажа'));

    expect(onStartClassic).toHaveBeenCalledTimes(1);
    expect(onStartAnagrams).toHaveBeenCalledTimes(1);
    expect(onStartSprint).toHaveBeenCalledTimes(1);
    expect(onStartHangman).toHaveBeenCalledTimes(1);
    expect(onStartMemory).toHaveBeenCalledTimes(1);
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    expect(onOpenPetRoom).toHaveBeenCalledTimes(1);
  });

  it('SetupScreen exposes upload and selected-mode start-game contracts for authenticated users', () => {
    const onFileUpload = vi.fn();
    const onStartGame = vi.fn();

    render(
      <SetupScreen
        selectedPlayMode="memory"
        settings={settings}
        customWordsCount={1}
        setupError={'Ошибка словаря'}
        isUploadingDictionary={false}
        isAuthenticated
        onSettingsChange={vi.fn()}
        onFileUpload={onFileUpload}
        onStartGame={onStartGame}
        onBack={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByText('Ошибка словаря')).toBeInTheDocument();
    expect(screen.getByText('Режим: Мемо')).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['APPLE'], 'dict.txt', { type: 'text/plain' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Играть: Мемо' }));

    expect(onFileUpload).toHaveBeenCalledTimes(1);
    expect(onStartGame).toHaveBeenCalledTimes(1);
  });

  it('SetupScreen gates custom dictionary for guests', () => {
    const onLogin = vi.fn();
    const onSettingsChange = vi.fn();

    render(
      <SetupScreen
        selectedPlayMode="game"
        settings={settings}
        customWordsCount={0}
        setupError={null}
        isUploadingDictionary={false}
        isAuthenticated={false}
        onSettingsChange={onSettingsChange}
        onFileUpload={vi.fn()}
        onStartGame={vi.fn()}
        onBack={vi.fn()}
        onLogin={onLogin}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Зарегистрироваться/i }));
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(document.querySelector('input[type="file"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Мой словарь/i }));
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('Shop closes through explicit callback', () => {
    const onClose = vi.fn();

    render(<Shop userProfile={profile} onBuy={vi.fn().mockResolvedValue(undefined)} onClose={onClose} />);

    fireEvent.click(screen.getAllByRole('button', { name: /На главный экран/i })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PetRoom closes through explicit callback', () => {
    const onClose = vi.fn();

    render(<PetRoom userProfile={profile} onUseItem={vi.fn().mockResolvedValue(undefined)} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /На главный экран/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PetWidget navigates through parent callback', () => {
    const onNavigateToPetRoom = vi.fn();

    render(<PetWidget pet={profile.pet} onNavigateToPetRoom={onNavigateToPetRoom} />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть комнату персонажа' }));

    expect(onNavigateToPetRoom).toHaveBeenCalledTimes(1);
  });
});