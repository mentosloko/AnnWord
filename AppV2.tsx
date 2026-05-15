import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthBootstrapGate } from './components/AuthBootstrapGate';
import { AppShell } from './components/AppShell';
import { AppScreens, PlayableModeRoute } from './components/AppScreens';
import { useAuthProfile } from './hooks/useAuthProfile';
import { useClassicGameController } from './hooks/useClassicGameController';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useDictionaryUpload } from './hooks/useDictionaryUpload';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { DictionarySource, ShopItem, UserStats, ViewState } from './types';

const AppV2: React.FC = () => {
  const [route, setRoute] = useState<ViewState>('landing');
  const [selectedPlayMode, setSelectedPlayMode] = useState<PlayableModeRoute>('game');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

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

  const setDictionarySource = useCallback((source: DictionarySource) => {
    setSettings(prev => ({
      ...prev,
      dictionarySource: source,
      useCustomDictionary: source === 'custom',
    }));
  }, [setSettings]);

  const dictionaryUpload = useDictionaryUpload({
    updateDictionary: profileEconomy.updateDictionary,
    setDictionarySource,
  });

  useEffect(() => {
    if (isAuthenticated) setShowLoginModal(false);
  }, [isAuthenticated]);

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

  return (
    <AppShell
      route={route}
      userProfile={userProfile}
      pet={userProfile.pet}
      isAuthenticated={isAuthenticated}
      showLoginModal={showLoginModal}
      showRulesModal={showRulesModal}
      authMode={authMode}
      tempUsername={tempUsername}
      tempPassword={tempPassword}
      authError={authError}
      isAuthLoading={isAuthLoading}
      onLoginClick={openLogin}
      onLogoutClick={handleLogout}
      onProfileClick={() => setRoute('profile')}
      onShopClick={() => setRoute('shop')}
      onNavigateToPetRoom={() => setRoute('pet_room')}
      onCloseLogin={() => setShowLoginModal(false)}
      onCloseRules={() => setShowRulesModal(false)}
      onAuthModeChange={setAuthMode}
      onUsernameChange={setTempUsername}
      onPasswordChange={setTempPassword}
      onAuthSubmit={submitEmailAuth}
      onYandexLogin={loginWithYandex}
    >
      <AppScreens
        route={route}
        selectedPlayMode={selectedPlayMode}
        userProfile={userProfile}
        isAuthenticated={isAuthenticated}
        settings={settings}
        modeWords={modeWords}
        classicGame={classicGame}
        dictionaryUpload={{
          isUploadingDictionary: dictionaryUpload.isUploadingDictionary,
          error: dictionaryUpload.dictionaryUploadError,
          onFileUpload: dictionaryUpload.handleDictionaryFileUpload,
        }}
        onRouteChange={setRoute}
        onSelectedPlayModeChange={setSelectedPlayMode}
        onSettingsChange={setSettings}
        onOpenLogin={openLogin}
        onOpenRules={() => setShowRulesModal(true)}
        onBuy={handleBuy}
        onUseItem={handleUseItem}
        onWinCoins={profileEconomy.winCoins}
      />
    </AppShell>
  );
};

export default AppV2;
