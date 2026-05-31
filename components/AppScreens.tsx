import React from 'react';
import { AppRouter } from './AppRouter';
import { LandingScreen } from './screens/LandingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { ClassicGameScreen } from './screens/ClassicGameScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CharacterOnboardingScreen } from './screens/CharacterOnboardingScreen';
import { AdminAnalyticsScreen } from './screens/AdminAnalyticsScreen';
import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from './screens/ModeScreens';
import { Shop } from './Shop';
import { PetRoom } from './PetRoom';
import { DailyQuestCompletionReward, DailyQuestState, GameSettings, GameState, CharStatus, PetState, ShopItem, UserProfile, ViewState } from '../types';
import { GameRewardInput } from '../services/gamificationRules';

export type PlayableModeRoute = 'game' | 'anagrams' | 'sprint' | 'memory' | 'hangman';

export interface ClassicGameScreenBindings {
  setupError: string | null;
  gameState: GameState;
  keyStatuses: Record<string, CharStatus>;
  shakeRowIndex: number | null;
  hasActiveGame?: boolean;
  resumeGame?: () => boolean;
  startNewGame: () => void;
  handleChar: (char: string) => void;
  handleDelete: () => void;
  handleEnter: () => void | Promise<void>;
  fetchHint: () => void | Promise<void>;
}

export interface DictionaryUploadBindings {
  isUploadingDictionary: boolean;
  error: string | null;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface AppScreensProps {
  route: ViewState;
  userProfile: UserProfile;
  isAuthenticated: boolean;
  dailyQuest?: DailyQuestState | null;
  dailyQuestReward?: DailyQuestCompletionReward | null;
  onCloseDailyQuestReward?: () => void;
  settings: GameSettings;
  modeWords: string[];
  selectedPlayMode: PlayableModeRoute;
  classicGame: ClassicGameScreenBindings;
  dictionaryUpload: DictionaryUploadBindings;
  onRouteChange: (route: ViewState) => void;
  onSelectedPlayModeChange: (mode: PlayableModeRoute) => void;
  onSettingsChange: (settings: GameSettings | ((prev: GameSettings) => GameSettings)) => void;
  onOpenLogin: () => void;
  onOpenRules: () => void;
  onBuy: (item: ShopItem) => Promise<void>;
  onUseItem: (itemId: string) => Promise<void>;
  onGameReward: (input: GameRewardInput) => Promise<void>;
  onRecordReviewWord?: (word: string) => Promise<void>;
  onCharacterOnboardingComplete: (character: PetState) => Promise<void>;
  onGameStarted?: (mode: PlayableModeRoute) => void;
}

export const AppScreens: React.FC<AppScreensProps> = ({
  route, userProfile, isAuthenticated, dailyQuest, dailyQuestReward, onCloseDailyQuestReward, settings, modeWords, selectedPlayMode, classicGame,
  dictionaryUpload, onRouteChange, onSelectedPlayModeChange, onSettingsChange, onOpenLogin,
  onOpenRules, onBuy, onUseItem, onGameReward, onRecordReviewWord, onCharacterOnboardingComplete, onGameStarted,
}) => {
  const goHome = () => onRouteChange('landing');
  const setupError = classicGame.setupError || dictionaryUpload.error;
  const hasActiveClassicGame = Boolean(classicGame.hasActiveGame);

  const openSetupFor = (mode: PlayableModeRoute) => {
    if (mode === 'game' && hasActiveClassicGame && classicGame.resumeGame?.()) return;
    onSelectedPlayModeChange(mode);
    onRouteChange('setup');
  };

  const startSelectedMode = () => {
    onGameStarted?.(selectedPlayMode);
    if (selectedPlayMode === 'game') {
      classicGame.startNewGame();
      return;
    }
    onRouteChange(selectedPlayMode);
  };

  const startQuestMode = (mode: PlayableModeRoute) => {
    onSelectedPlayModeChange(mode);
    onGameStarted?.(mode);
    if (mode === 'game') {
      if (hasActiveClassicGame && classicGame.resumeGame?.()) return;
      classicGame.startNewGame();
      return;
    }
    onRouteChange(mode);
  };

  const startDailyQuest = (quest: DailyQuestState) => {
    if (quest.kind === 'hangman_clean') return startQuestMode('hangman');
    if (quest.kind === 'sprint_twelve') return startQuestMode('sprint');
    if (quest.kind === 'memory_sixteen') return startQuestMode('memory');
    return startQuestMode('game');
  };

  const screens: Partial<Record<ViewState, React.ReactNode>> = {
    admin: <AdminAnalyticsScreen userProfile={userProfile} onBackHome={goHome} />,
    character_onboarding: <CharacterOnboardingScreen onComplete={onCharacterOnboardingComplete} />,
    landing: (
      <LandingScreen
        userProfile={userProfile}
        isAuthenticated={isAuthenticated}
        dailyQuest={dailyQuest}
        dailyQuestReward={dailyQuestReward}
        onCloseDailyQuestReward={onCloseDailyQuestReward}
        onStartDailyQuest={startDailyQuest}
        hasActiveClassicGame={hasActiveClassicGame}
        onStartClassic={() => openSetupFor('game')}
        onStartAnagrams={() => openSetupFor('anagrams')}
        onStartSprint={() => openSetupFor('sprint')}
        onStartHangman={() => openSetupFor('hangman')}
        onStartMemory={() => openSetupFor('memory')}
        onOpenShop={() => onRouteChange('shop')}
        onOpenRules={onOpenRules}
        onOpenLogin={onOpenLogin}
        onOpenProfile={() => onRouteChange('profile')}
        onOpenPetRoom={() => onRouteChange('pet_room')}
      />
    ),
    setup: (
      <SetupScreen
        selectedPlayMode={selectedPlayMode}
        settings={settings}
        customDictionaryWords={userProfile.customDictionaryEn}
        setupError={setupError}
        isUploadingDictionary={dictionaryUpload.isUploadingDictionary}
        isAuthenticated={isAuthenticated}
        onSettingsChange={onSettingsChange}
        onFileUpload={dictionaryUpload.onFileUpload}
        onStartGame={startSelectedMode}
        onBack={goHome}
        onLogin={onOpenLogin}
      />
    ),
    game: (
      <ClassicGameScreen
        gameState={classicGame.gameState}
        settings={settings}
        userProfile={userProfile}
        keyStatuses={classicGame.keyStatuses}
        shakeRowIndex={classicGame.shakeRowIndex}
        onChar={classicGame.handleChar}
        onDelete={classicGame.handleDelete}
        onEnter={classicGame.handleEnter}
        onHint={classicGame.fetchHint}
        onRestart={classicGame.startNewGame}
        onBackHome={goHome}
      />
    ),
    profile: <ProfileScreen userProfile={userProfile} isAuthenticated={isAuthenticated} onBackHome={goHome} onOpenShop={() => onRouteChange('shop')} onOpenPetRoom={() => onRouteChange('pet_room')} onLogin={onOpenLogin} />,
    anagrams: <AnagramsScreen words={modeWords} userProfile={userProfile} onGameReward={onGameReward} onRecordReviewWord={onRecordReviewWord} onBackHome={goHome} />,
    sprint: <SprintScreen words={modeWords} userProfile={userProfile} onGameReward={onGameReward} onBackHome={goHome} />,
    memory: <MemoryScreen words={modeWords} userProfile={userProfile} onGameReward={onGameReward} onBackHome={goHome} />,
    hangman: <HangmanScreen words={modeWords} userProfile={userProfile} onGameReward={onGameReward} onBackHome={goHome} />,
    shop: <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} />,
    pet_room: <PetRoom userProfile={userProfile} onUseItem={onUseItem} onBuy={onBuy} onClose={goHome} onOpenShop={() => onRouteChange('shop')} />,
  };

  return <AppRouter route={route} screens={screens} fallback={screens.landing} />;
};
