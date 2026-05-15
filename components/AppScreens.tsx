import React from 'react';
import { AppRouter } from './AppRouter';
import { LandingScreen } from './screens/LandingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { ClassicGameScreen } from './screens/ClassicGameScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from './screens/ModeScreens';
import { Shop } from './Shop';
import { PetRoom } from './PetRoom';
import { GameSettings, GameState, CharStatus, ShopItem, UserProfile, ViewState } from '../types';

export interface ClassicGameScreenBindings {
  setupError: string | null;
  gameState: GameState;
  keyStatuses: Record<string, CharStatus>;
  shakeRowIndex: number | null;
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
  settings: GameSettings;
  modeWords: string[];
  classicGame: ClassicGameScreenBindings;
  dictionaryUpload: DictionaryUploadBindings;
  onRouteChange: (route: ViewState) => void;
  onSettingsChange: (settings: GameSettings | ((prev: GameSettings) => GameSettings)) => void;
  onOpenLogin: () => void;
  onOpenRules: () => void;
  onBuy: (item: ShopItem) => Promise<void>;
  onUseItem: (itemId: string) => Promise<void>;
  onWinCoins: (amount: number) => Promise<void>;
}

export const AppScreens: React.FC<AppScreensProps> = ({
  route,
  userProfile,
  isAuthenticated,
  settings,
  modeWords,
  classicGame,
  dictionaryUpload,
  onRouteChange,
  onSettingsChange,
  onOpenLogin,
  onOpenRules,
  onBuy,
  onUseItem,
  onWinCoins,
}) => {
  const goHome = () => onRouteChange('landing');
  const setupError = classicGame.setupError || dictionaryUpload.error;

  const screens: Partial<Record<ViewState, React.ReactNode>> = {
    landing: (
      <LandingScreen
        userProfile={userProfile}
        isAuthenticated={isAuthenticated}
        onStartClassic={() => onRouteChange('setup')}
        onStartAnagrams={() => onRouteChange('anagrams')}
        onStartSprint={() => onRouteChange('sprint')}
        onStartHangman={() => onRouteChange('hangman')}
        onStartMemory={() => onRouteChange('memory')}
        onOpenShop={() => onRouteChange('shop')}
        onOpenRules={onOpenRules}
        onOpenLogin={onOpenLogin}
        onOpenProfile={() => onRouteChange('profile')}
      />
    ),
    setup: (
      <SetupScreen
        settings={settings}
        customWordsCount={userProfile.customDictionaryEn.length}
        setupError={setupError}
        isUploadingDictionary={dictionaryUpload.isUploadingDictionary}
        onSettingsChange={onSettingsChange}
        onFileUpload={dictionaryUpload.onFileUpload}
        onStartGame={classicGame.startNewGame}
        onBack={goHome}
      />
    ),
    game: (
      <ClassicGameScreen
        gameState={classicGame.gameState}
        settings={settings}
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
    profile: (
      <ProfileScreen
        userProfile={userProfile}
        isAuthenticated={isAuthenticated}
        onBackHome={goHome}
        onOpenShop={() => onRouteChange('shop')}
        onLogin={onOpenLogin}
      />
    ),
    anagrams: <AnagramsScreen words={modeWords} userProfile={userProfile} onWin={onWinCoins} onBackHome={goHome} />,
    sprint: <SprintScreen words={modeWords} userProfile={userProfile} onWin={onWinCoins} onBackHome={goHome} />,
    memory: <MemoryScreen words={modeWords} userProfile={userProfile} onWin={onWinCoins} onBackHome={goHome} />,
    hangman: <HangmanScreen words={modeWords} userProfile={userProfile} onWin={onWinCoins} onBackHome={goHome} />,
    shop: <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} />,
    pet_room: <PetRoom userProfile={userProfile} onUseItem={onUseItem} onClose={goHome} />,
  };

  return <AppRouter route={route} screens={screens} fallback={screens.landing} />;
};
