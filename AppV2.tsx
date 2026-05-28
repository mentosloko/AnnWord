import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AppScreens, PlayableModeRoute } from './components/AppScreens';
import { AuthBootstrapGate } from './components/AuthBootstrapGate';
import { useAuthProfile } from './hooks/useAuthProfile';
import { useClassicGameController } from './hooks/useClassicGameController';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useDictionaryUpload } from './hooks/useDictionaryUpload';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { DictionarySource, PetState, ShopItem, UserStats, ViewState } from './types';
import { analyticsService } from './services/analyticsService';
import { GameRewardInput } from './services/gamificationRules';
import { preloadAppAssetsForProfile } from './services/assetPreloader';

const AppV2: React.FC = () => {
  const [route, setRouteState] = useState<ViewState>('landing');
  const [selectedPlayMode, setSelectedPlayMode] = useState<PlayableModeRoute>('game');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const authProfile = useAuthProfile();
  const {
    bootstrapStatus,
    bootstrapError,
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

  const currentUserId = currentUser?.id ?? null;
  const { getSecretWordPool, getValidationPool, getModeWords } = useDictionaryPools({ settings, userProfile });

  const profileEconomy = useProfileEconomy({
    currentUserId,
    userProfile,
    setUserProfile,
  });

  const setRoute = useCallback((nextRoute: ViewState) => {
    setRouteState(previousRoute => {
      if (previousRoute !== nextRoute) {
        void analyticsService.trackEvent({
          userId: currentUserId,
          eventType: 'navigation',
          eventName: 'route_changed',
          route: nextRoute,
          payload: {
            previousRoute,
            nextRoute,
          },
        });
      }
      return nextRoute;
    });
  }, [currentUserId]);

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

  useEffect(() => {
    if (bootstrapStatus !== 'ready') return;
    preloadAppAssetsForProfile(userProfile);
  }, [bootstrapStatus, userProfile.pet.type, userProfile.pet.characterOnboarded]);

  useEffect(() => {
    if (bootstrapStatus !== 'ready' || !isAuthenticated) return;
    if (route !== 'character_onboarding' && !userProfile.pet.characterOnboarded) {
      setRoute('character_onboarding');
    }
  }, [bootstrapStatus, isAuthenticated, route, setRoute, userProfile.pet.characterOnboarded]);

  const openLogin = useCallback(() => {
    openLoginMode();
    setShowLoginModal(true);
  }, [openLoginMode]);

  const handleLogout = useCallback(async () => {
    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'auth',
      eventName: 'logout',
      route,
    });
    await logout();
    setRoute('landing');
  }, [currentUserId, logout, route, setRoute]);

  const updateClassicStats = useCallback(async (won: boolean, word: string, coinsAdjustment = 0) => {
    const nextStats: UserStats = {
      ...userProfile.stats,
      wordsGuessed: { ...userProfile.stats.wordsGuessed },
    };

    nextStats.gamesPlayed += 1;

    if (won) {
      nextStats.gamesWon += 1;
      nextStats.wordsGuessed[word] = (nextStats.wordsGuessed[word] || 0) + 1;
    }

    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'game',
      eventName: 'game_finished',
      gameType: 'wordle',
      route: 'game',
      payload: {
        won,
        word,
        coinsAdjustment,
        wordLength: settings.wordLength,
        dictionarySource: settings.dictionarySource,
        difficulty: settings.difficulty,
        gamesPlayedBefore: userProfile.stats.gamesPlayed,
        gamesWonBefore: userProfile.stats.gamesWon,
      },
    });

    await profileEconomy.applyGameReward({ type: 'wordle', won, coinsAdjustment });
    await profileEconomy.updateStats(nextStats);
  }, [currentUserId, profileEconomy, settings.dictionarySource, settings.difficulty, settings.wordLength, userProfile.stats]);

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
  const handleGameReward = useCallback(async (input: GameRewardInput) => {
    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'game',
      eventName: 'game_finished',
      gameType: input.type,
      route: input.type === 'other' ? route : input.type,
      payload: {
        ...input,
        wordLength: settings.wordLength,
        dictionarySource: settings.dictionarySource,
        difficulty: settings.difficulty,
      },
    });
    await profileEconomy.applyGameReward(input);
  }, [currentUserId, profileEconomy, route, settings.dictionarySource, settings.difficulty, settings.wordLength]);

  const handleCharacterOnboardingComplete = useCallback(async (character: PetState) => {
    await analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'character',
      eventName: 'character_selected',
      route: 'character_onboarding',
      payload: {
        characterType: character.type,
        characterName: character.name,
      },
    });
    await profileEconomy.updateCharacter(character);
    setRoute('landing');
  }, [currentUserId, profileEconomy, setRoute]);

  const startTrackedGame = useCallback((mode: PlayableModeRoute) => {
    void analyticsService.trackEvent({
      userId: currentUserId,
      eventType: 'game',
      eventName: 'game_started',
      gameType: mode === 'game' ? 'wordle' : mode,
      route: mode,
      payload: {
        wordLength: settings.wordLength,
        dictionarySource: settings.dictionarySource,
        difficulty: settings.difficulty,
        wordsAvailable: modeWords.length,
      },
    });
  }, [currentUserId, modeWords.length, settings.dictionarySource, settings.difficulty, settings.wordLength]);

  if (bootstrapStatus !== 'ready') {
    return <AuthBootstrapGate error={bootstrapError} onRetry={() => window.location.reload()} />;
  }

  return (
    <AppShell
      route={route}
      userProfile={userProfile}
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
      onAdminClick={() => setRoute('admin')}
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
        onGameReward={handleGameReward}
        onCharacterOnboardingComplete={handleCharacterOnboardingComplete}
        onGameStarted={startTrackedGame}
      />
    </AppShell>
  );
};

export default AppV2;