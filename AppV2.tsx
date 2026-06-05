import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AppScreens, PlayableModeRoute } from './components/AppScreens';
import { AuthBootstrapGate } from './components/AuthBootstrapGate';
import { useAuthProfile } from './hooks/useAuthProfile';
import { useClassicGameController } from './hooks/useClassicGameController';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useDictionaryUpload } from './hooks/useDictionaryUpload';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { AccountMode, DailyQuestCompletionReward, DailyQuestState, DictionarySource, GameRewardType, PetState, ShopItem, UserStats, ViewState } from './types';
import { analyticsService } from './services/analyticsService';
import { GameRewardInput } from './services/gamificationRules';
import { updateReviewPriorities, WordPracticeResult } from './services/gameSessionEngine';
import { preloadAppAssetsForProfile } from './services/assetPreloader';
import { WORDLE_HINT_COST, getWordleHintBalanceDelta } from './services/wordleEconomy';
import { dailyQuestService } from './services/dailyQuestService';
import { premiumDictionaryService, PremiumDictionaryDraft } from './services/premiumDictionaryService';
import { ChildSetupResult, familyAccountService } from './services/familyAccountService';

const toAnalyticsGameType = (mode: PlayableModeRoute): GameRewardType => mode === 'game' ? 'wordle' : mode === 'anagrams' ? 'anagram' : mode;

const AppV2: React.FC = () => {
  const [route, setRouteState] = useState<ViewState>('landing');
  const [selectedPlayMode, setSelectedPlayMode] = useState<PlayableModeRoute>('game');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [dailyQuest, setDailyQuest] = useState<DailyQuestState | null>(null);
  const [dailyQuestReward, setDailyQuestReward] = useState<DailyQuestCompletionReward | null>(null);
  const authProfile = useAuthProfile();
  const { bootstrapStatus, bootstrapError, settings, setSettings, userProfile, setUserProfile, currentUser, cachedUserId, isAuthenticated, authMode, setAuthMode, tempUsername, setTempUsername, tempPassword, setTempPassword, authError, isAuthLoading, openLoginMode, submitEmailAuth, loginWithYandex, logout } = authProfile;
  const currentUserId = currentUser?.id ?? cachedUserId ?? null;
  const { getSecretWordPool, getValidationPool, getModeWords } = useDictionaryPools({ settings, userProfile });
  const profileEconomy = useProfileEconomy({ currentUserId, userProfile, setUserProfile });
  const wordReviewStatsRef = useRef<UserStats>(userProfile.stats);
  const wordPracticeSyncRef = useRef<Promise<void>>(Promise.resolve());
  const isTeacher = userProfile.accountMode === 'teacher' || userProfile.role === 'teacher';
  const isKids = userProfile.accountMode === 'parent' || userProfile.role === 'parent';
  const isPractice = userProfile.accountMode === 'player' && userProfile.role !== 'parent' && userProfile.role !== 'teacher';

  useEffect(() => { wordReviewStatsRef.current = userProfile.stats; }, [userProfile.stats]);
  const setRoute = useCallback((nextRoute: ViewState) => setRouteState(previousRoute => { if (previousRoute !== nextRoute) analyticsService.trackEvent({ userId: currentUserId, eventType: 'navigation', eventName: 'route_changed', route: nextRoute, payload: { previousRoute, nextRoute } }); return nextRoute; }), [currentUserId]);
  const setDictionarySource = useCallback((source: DictionarySource) => setSettings(previous => ({ ...previous, dictionarySource: source, useCustomDictionary: source === 'custom' })), [setSettings]);
  const dictionaryUpload = useDictionaryUpload({ updateDictionary: profileEconomy.updateDictionary, setDictionarySource });

  useEffect(() => { if (isAuthenticated) setShowLoginModal(false); }, [isAuthenticated]);
  useEffect(() => { if (bootstrapStatus === 'ready' && isKids) preloadAppAssetsForProfile(userProfile); }, [bootstrapStatus, isKids, userProfile.pet.type, userProfile.pet.characterOnboarded]);
  useEffect(() => {
    if (bootstrapStatus !== 'ready' || !isAuthenticated) return;
    if (userProfile.role !== 'admin' && !userProfile.accountMode) { if (route !== 'account_mode_setup') setRoute('account_mode_setup'); return; }
    if (isTeacher) { if (route !== 'adult_room' && route !== 'dictionary_studio') setRoute('adult_room'); return; }
    if (isKids && !userProfile.childDisplayName) { if (route !== 'family_setup') setRoute('family_setup'); return; }
    if (isKids && route !== 'character_onboarding' && !userProfile.pet.characterOnboarded) { setRoute('character_onboarding'); return; }
    if (isPractice && (route === 'account_mode_setup' || route === 'family_setup' || route === 'character_onboarding')) setRoute('landing');
  }, [bootstrapStatus, isAuthenticated, isKids, isPractice, isTeacher, route, setRoute, userProfile.accountMode, userProfile.childDisplayName, userProfile.pet.characterOnboarded, userProfile.role]);

  const loadDailyQuest = useCallback(async () => {
    if (bootstrapStatus !== 'ready' || !isAuthenticated || !isKids || !userProfile.pet.characterOnboarded) { setDailyQuest(null); return; }
    try { setDailyQuest(await dailyQuestService.getTodayQuest()); } catch (error) { console.error('Failed to load daily quest', error); }
  }, [bootstrapStatus, isAuthenticated, isKids, userProfile.pet.characterOnboarded]);
  useEffect(() => {
    void loadDailyQuest();
    if (bootstrapStatus !== 'ready' || !isAuthenticated || !isKids || !userProfile.pet.characterOnboarded || typeof window === 'undefined' || typeof document === 'undefined') return;
    const refreshVisibleQuest = () => { if (document.visibilityState === 'visible') void loadDailyQuest(); };
    window.addEventListener('focus', refreshVisibleQuest); document.addEventListener('visibilitychange', refreshVisibleQuest);
    const intervalId = window.setInterval(refreshVisibleQuest, 60_000);
    return () => { window.removeEventListener('focus', refreshVisibleQuest); document.removeEventListener('visibilitychange', refreshVisibleQuest); window.clearInterval(intervalId); };
  }, [bootstrapStatus, isAuthenticated, isKids, loadDailyQuest, userProfile.pet.characterOnboarded]);

  const openLogin = useCallback(() => { openLoginMode(); setShowLoginModal(true); }, [openLoginMode]);
  const handleLogout = useCallback(async () => { analyticsService.trackEvent({ userId: currentUserId, eventType: 'auth', eventName: 'logout', route }); await analyticsService.flush(); await logout(); setDailyQuest(null); setDailyQuestReward(null); setRoute('landing'); }, [currentUserId, logout, route, setRoute]);
  const submitDailyQuestResult = useCallback(async (input: GameRewardInput) => { if (!isAuthenticated || !isKids || !userProfile.pet.characterOnboarded) return; try { const result = await dailyQuestService.submitGameResult(input); setDailyQuest(result.quest); if (result.profile) setUserProfile(result.profile); if (result.reward) setDailyQuestReward(result.reward); } catch (error) { console.error('Failed to apply daily quest result', error); } }, [isAuthenticated, isKids, setUserProfile, userProfile.pet.characterOnboarded]);
  const updateClassicStats = useCallback(async (won: boolean, word: string, coinsAdjustment = 0) => { const nextStats: UserStats = { ...userProfile.stats, wordsGuessed: { ...userProfile.stats.wordsGuessed }, wordsToReview: { ...(userProfile.stats.wordsToReview || {}) } }; nextStats.gamesPlayed += 1; if (won) { nextStats.gamesWon += 1; nextStats.wordsGuessed[word] = (nextStats.wordsGuessed[word] || 0) + 1; } const event = analyticsService.createEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: 'wordle', route: 'game', payload: { won, word, coinsAdjustment, wordLength: settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty } }); await profileEconomy.applyGameReward({ type: 'wordle', won, coinsAdjustment }, { stats: nextStats, analyticsEvents: [event] }); }, [currentUserId, profileEconomy, settings.dictionarySource, settings.difficulty, settings.wordLength, userProfile.stats]);
  const submitClassicDailyQuestResult = useCallback(async (won: boolean, _word: string, attempts: number) => submitDailyQuestResult({ type: 'wordle', won, attempts }), [submitDailyQuestResult]);
  const chargeWordleHint = useCallback(async (): Promise<boolean> => { if (!isKids) return true; if (userProfile.coins < WORDLE_HINT_COST) return false; await profileEconomy.winCoins(getWordleHintBalanceDelta()); return true; }, [isKids, profileEconomy, userProfile.coins]);
  const classicGame = useClassicGameController({ route, settings, sessionOwnerId: currentUserId, getSecretWordPool, getValidationPool, getModeWords, onRouteChange: setRoute, onStatsUpdate: updateClassicStats, onDailyQuestResult: submitClassicDailyQuestResult, availableCoins: isKids ? userProfile.coins : Number.MAX_SAFE_INTEGER, onHintCharge: chargeWordleHint });
  const modeWords = useMemo(() => getModeWords({ respectWordLength: true }), [getModeWords]);
  const handleBuy = useCallback(async (item: ShopItem) => { if (!isKids) return; return profileEconomy.buyItem(item); }, [isKids, profileEconomy]);
  const handleUseItem = useCallback(async (itemId: string) => { if (!isKids) return; return profileEconomy.useItem(itemId); }, [isKids, profileEconomy]);
  const handleSaveDictionary = useCallback(async (draft: PremiumDictionaryDraft) => { const collection = await premiumDictionaryService.saveCollection(draft); setUserProfile(previous => ({ ...previous, customDictionaryEn: previous.role === 'teacher' ? previous.customDictionaryEn : collection.words, dictionaryCollections: [collection, ...(previous.dictionaryCollections || []).filter(item => item.id !== collection.id)] })); if (!isTeacher) setDictionarySource('custom'); }, [isTeacher, setDictionarySource, setUserProfile]);
  const handleSelectAccountMode = useCallback(async (mode: AccountMode) => {
    await familyAccountService.selectAccountMode(mode);
    setUserProfile(previous => ({ ...previous, accountMode: mode, role: mode === 'parent' ? 'parent' : mode === 'teacher' ? 'teacher' : 'user', featureFlags: mode === 'player' ? previous.featureFlags : { ...(previous.featureFlags || {}), adultRoom: true } }));
    setRoute(mode === 'teacher' ? 'adult_room' : mode === 'parent' ? 'family_setup' : 'landing');
  }, [setRoute, setUserProfile]);
  const handleCreateChild = useCallback(async (childName: string, pin: string): Promise<ChildSetupResult> => familyAccountService.createChild(childName, pin), []);
  const handleChildSetupComplete = useCallback((result: ChildSetupResult) => { setUserProfile(previous => ({ ...previous, role: 'parent', accountMode: 'parent', childDisplayName: result.childName, childShareCode: result.childShareCode, childSlotsLimit: result.childSlotsLimit, featureFlags: { ...(previous.featureFlags || {}), adultRoom: true } })); setRoute('character_onboarding'); }, [setRoute, setUserProfile]);
  const handleGameReward = useCallback(async (input: GameRewardInput) => { const event = analyticsService.createEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: input.type, route: input.type === 'other' ? route : input.type, payload: { ...input, wordLength: settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty } }); if (!isKids) { analyticsService.trackEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: input.type, route: input.type === 'other' ? route : input.type, payload: event.payload }); return; } await profileEconomy.applyGameReward(input, { analyticsEvents: [event] }); await submitDailyQuestResult(input); }, [currentUserId, isKids, profileEconomy, route, settings.dictionarySource, settings.difficulty, settings.wordLength, submitDailyQuestResult]);
  const handleWordPractice = useCallback(async (word: string, result: WordPracticeResult) => { const previousStats = wordReviewStatsRef.current; const nextStats: UserStats = { ...previousStats, wordsGuessed: { ...previousStats.wordsGuessed }, wordsToReview: updateReviewPriorities(previousStats.wordsToReview || {}, word, result) }; wordReviewStatsRef.current = nextStats; wordPracticeSyncRef.current = wordPracticeSyncRef.current.catch(() => undefined).then(() => profileEconomy.updateStats(nextStats)); await wordPracticeSyncRef.current; }, [profileEconomy]);
  const handleCharacterOnboardingComplete = useCallback(async (character: PetState) => { await profileEconomy.updateCharacter(character); setRoute('landing'); }, [profileEconomy, setRoute]);
  const startTrackedGame = useCallback((mode: PlayableModeRoute) => { analyticsService.trackEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_started', gameType: toAnalyticsGameType(mode), route: mode, payload: { wordLength: settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty, wordsAvailable: modeWords.length } }); }, [currentUserId, modeWords.length, settings.dictionarySource, settings.difficulty, settings.wordLength]);
  if (bootstrapStatus !== 'ready') return <AuthBootstrapGate error={bootstrapError} onRetry={() => window.location.reload()} />;
  return <AppShell route={route} userProfile={userProfile} isAuthenticated={isAuthenticated} showLoginModal={showLoginModal} showRulesModal={showRulesModal} authMode={authMode} tempUsername={tempUsername} tempPassword={tempPassword} authError={authError} isAuthLoading={isAuthLoading} onHomeClick={() => setRoute('landing')} onLoginClick={openLogin} onLogoutClick={handleLogout} onProfileClick={() => setRoute('profile')} onShopClick={() => setRoute('shop')} onAdminClick={() => setRoute('admin')} onAdultRoomClick={() => setRoute('adult_room')} onDictionaryStudioClick={() => setRoute('dictionary_studio')} onCloseLogin={() => setShowLoginModal(false)} onCloseRules={() => setShowRulesModal(false)} onAuthModeChange={setAuthMode} onUsernameChange={setTempUsername} onPasswordChange={setTempPassword} onAuthSubmit={submitEmailAuth} onYandexLogin={loginWithYandex}><AppScreens route={route} selectedPlayMode={selectedPlayMode} userProfile={userProfile} isAuthenticated={isAuthenticated} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={() => setDailyQuestReward(null)} settings={settings} modeWords={modeWords} classicGame={classicGame} dictionaryUpload={{ isUploadingDictionary: dictionaryUpload.isUploadingDictionary, error: dictionaryUpload.dictionaryUploadError, onFileUpload: dictionaryUpload.handleDictionaryFileUpload }} onRouteChange={setRoute} onSelectedPlayModeChange={setSelectedPlayMode} onSettingsChange={setSettings} onOpenLogin={openLogin} onOpenRules={() => setShowRulesModal(true)} onBuy={handleBuy} onUseItem={handleUseItem} onUpdatePet={profileEconomy.updateCharacter} onSaveDictionary={handleSaveDictionary} onSelectAccountMode={handleSelectAccountMode} onCreateChild={handleCreateChild} onChildSetupComplete={handleChildSetupComplete} onGameReward={handleGameReward} onWordPractice={handleWordPractice} onCharacterOnboardingComplete={handleCharacterOnboardingComplete} onGameStarted={startTrackedGame} /></AppShell>;
};
export default AppV2;
