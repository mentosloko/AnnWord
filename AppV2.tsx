import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppRouter } from './components/AppRouter';
import { AppHeader } from './components/layout/AppHeader';
import { AppModals } from './components/AppModals';
import { AuthBootstrapGate } from './components/AuthBootstrapGate';
import { LandingScreen } from './components/screens/LandingScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { ClassicGameScreen } from './components/screens/ClassicGameScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from './components/screens/ModeScreens';
import { Shop } from './components/Shop';
import { PetRoom } from './components/PetRoom';
import { PetWidget } from './components/PetWidget';
import { useAuthProfile } from './hooks/useAuthProfile';
import { useClassicGameController } from './hooks/useClassicGameController';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { ShopItem, UserStats, ViewState } from './types';

const AppV2: React.FC = () => {
  const [route, setRoute] = useState<ViewState>('landing');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isUploadingDict, setIsUploadingDict] = useState(false);

  const authProfile = useAuthProfile();
  const {
    bootstrapStatus,
    bootstrapError,
    continueAsGuestAfterBootstrapError,
    settings,
    setSettings,
    userProfile,
    setUserProfile,
    currentUser,
    isAuthenticated,
    authMode,
    setAuthMode,
    tempUsername,
    setTempUsername,
    tempPassword,
    setTempPassword,
    authError,
    isAuthLoading,
    openLoginMode,
    submitEmailAuth,
    loginWithYandex,
    logout,
  } = authProfile;

  const { getSecretWordPool, getValidationPool, getModeWords } = useDictionaryPools({ settings, userProfile });
  const profileEconomy = useProfileEconomy({
    currentUserId: currentUser?.id ?? null,
    userProfile,
    setUserProfile,
  });

  useEffect(() => {
    if (isAuthenticated) setShowLoginModal(false);
  }, [isAuthenticated]);

  const goHome = useCallback(() => setRoute('landing'), []);

  const openLogin = useCallback(() => {
    openLoginMode();
    setShowLoginModal(true);
  }, [openLoginMode]);

  const handleLogout = useCallback(async () => {
    await logout();
    setRoute('landing');
  }, [logout]);

  const updateClassicStats = useCallback(async (won: boolean, word: string) => {
    const nextStats: UserStats = {
      ...userProfile.stats,
      wordsGuessed: { ...userProfile.stats.wordsGuessed },
    };

    nextStats.gamesPlayed += 1;

    if (won) {
      nextStats.gamesWon += 1;
      nextStats.wordsGuessed[word] = (nextStats.wordsGuessed[word] || 0) + 1;
      await profileEconomy.addXP(50);
      await profileEconomy.winCoins(20);
    }

    await profileEconomy.updateStats(nextStats);
  }, [profileEconomy, userProfile.stats]);

  const classicGame = useClassicGameController({
    route,
    settings,
    getSecretWordPool,
    getValidationPool,
    getModeWords,
    onRouteChange: setRoute,
    onStatsUpdate: updateClassicStats,
  });

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingDict(true);
    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      try {
        const text = String(readerEvent.target?.result || '');
        const cleanedWords = text
          .split(/[\n\s,]+/)
          .map(word => word.trim().toUpperCase().replace(/[^A-Z]/g, ''))
          .filter(Boolean);

        await profileEconomy.updateDictionary(cleanedWords);
        setSettings(prev => ({ ...prev, dictionarySource: 'custom', useCustomDictionary: true }));
      } finally {
        setIsUploadingDict(false);
      }
    };
    reader.readAsText(file);
  }, [profileEconomy, setSettings]);

  const modeWords = useMemo(() => getModeWords(), [getModeWords]);

  const handleBuy = useCallback(async (item: ShopItem) => profileEconomy.buyItem(item), [profileEconomy]);
  const handleUseItem = useCallback(async (itemId: string) => profileEconomy.useItem(itemId), [profileEconomy]);

  if (bootstrapStatus === 'loading' || bootstrapStatus === 'error') {
    return (
      <AuthBootstrapGate
        error={bootstrapError}
        onContinueAsGuest={bootstrapStatus === 'error' ? continueAsGuestAfterBootstrapError : undefined}
      />
    );
  }

  const screens: Partial<Record<ViewState, React.ReactNode>> = {
    landing: (
      <LandingScreen
        userProfile={userProfile}
        isAuthenticated={isAuthenticated}
        onStartClassic={() => setRoute('setup')}
        onStartAnagrams={() => setRoute('anagrams')}
        onStartSprint={() => setRoute('sprint')}
        onStartHangman={() => setRoute('hangman')}
        onStartMemory={() => setRoute('memory')}
        onOpenShop={() => setRoute('shop')}
        onOpenRules={() => setShowRulesModal(true)}
        onOpenLogin={openLogin}
        onOpenProfile={() => setRoute('profile')}
      />
    ),
    setup: (
      <SetupScreen
        settings={settings}
        customWordsCount={userProfile.customDictionaryEn.length}
        setupError={classicGame.setupError}
        isUploadingDictionary={isUploadingDict}
        onSettingsChange={setSettings}
        onFileUpload={handleFileUpload}
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
        onOpenShop={() => setRoute('shop')}
        onLogin={openLogin}
      />
    ),
    anagrams: <AnagramsScreen words={modeWords} onWin={profileEconomy.winCoins} onBackHome={goHome} />,
    sprint: <SprintScreen words={modeWords} onWin={profileEconomy.winCoins} onBackHome={goHome} />,
    memory: <MemoryScreen words={modeWords} onWin={profileEconomy.winCoins} onBackHome={goHome} />,
    hangman: <HangmanScreen words={modeWords} onWin={profileEconomy.winCoins} onBackHome={goHome} />,
    shop: <Shop userProfile={userProfile} onBuy={handleBuy} onClose={goHome} />,
    pet_room: <PetRoom userProfile={userProfile} onUseItem={handleUseItem} onClose={goHome} />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
      <AppHeader
        userProfile={userProfile}
        isAuthenticated={isAuthenticated}
        onLoginClick={openLogin}
        onLogoutClick={handleLogout}
        onProfileClick={() => setRoute('profile')}
        onShopClick={() => setRoute('shop')}
      />

      <AppRouter route={route} screens={screens} fallback={screens.landing} />

      {route !== 'pet_room' && route !== 'shop' && (
        <PetWidget pet={userProfile.pet} onNavigateToPetRoom={() => setRoute('pet_room')} />
      )}

      <AppModals
        showLoginModal={showLoginModal}
        showRulesModal={showRulesModal}
        authMode={authMode}
        tempUsername={tempUsername}
        tempPassword={tempPassword}
        authError={authError}
        isAuthLoading={isAuthLoading}
        onCloseLogin={() => setShowLoginModal(false)}
        onCloseRules={() => setShowRulesModal(false)}
        onAuthModeChange={setAuthMode}
        onUsernameChange={setTempUsername}
        onPasswordChange={setTempPassword}
        onAuthSubmit={submitEmailAuth}
        onYandexLogin={loginWithYandex}
      />
    </div>
  );
};

export default AppV2;
