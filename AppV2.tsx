import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthBootstrapGate } from './components/AuthBootstrapGate';
import { AppShell } from './components/AppShell';
import { AppScreens, type PlayableModeRoute } from './components/AppScreens';
import { InfoModal } from './components/ui/InfoModal';
import { useAuthProfile } from './hooks/useAuthProfile';
import { useClassicGameController } from './hooks/useClassicGameController';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useDictionaryUpload } from './hooks/useDictionaryUpload';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { analyticsService } from './services/analyticsService';
import { clearRegistrationIntent, readRegistrationIntent, rememberRegistrationIntent } from './services/registrationIntent';
import { familyAccountService, type ChildSetupResult } from './services/familyAccountService';
import { dailyQuestService } from './services/dailyQuestService';
import { doesGameResultCompleteDailyQuest } from './services/dailyQuest';
import { getDefaultPremiumDictionaryId } from './services/premiumDictionaryCatalog';
import { normalizePracticeWord, updateReviewPriorities, updateWordLearningHistory } from './services/wordReviewEngine';
import { gameEventLedgerService } from './services/gameEventLedgerService';
import { premiumDictionaryService, type PremiumDictionaryDraft } from './services/premiumDictionaryService';
import { paymentReturnStatus as normalizePaymentReturnStatus } from './services/paymentReturn';
import { getInitialClientLocation, type ClientEntryPath } from './services/clientEntryPath';
import { analyticsRouteForPath, pathForClientRoute, routeForClientPath } from './services/clientRouting';
import { readRewardEducation, markRewardEducation, type RewardEducationKind } from './services/rewardEducation';
import { loadingNow, loadingTelemetry } from './services/loadingTelemetry';
import { type AccountMode, type DailyQuestCompletionReward, type DailyQuestState, type PetState, type ShopItem, type UserProfile, type UserStats, type ViewState, type WordLength } from './types';
import { calculateGameReward, type GameRewardInput, type GameRewardType } from './services/gamificationRules';
import type { WordPracticeResult } from './services/gameSessionEngine';

const PAYMENT_ORDER_STORAGE_KEY = 'annword_last_payment_order_id';
const PENDING_ROUTE_STORAGE_KEY = 'annword_pending_route_v1';
const BACKEND_TOKEN_STORAGE_KEY = 'annword_backend_access_token_v1';
const WORDLE_HINT_COST = 1;

const isLengthAgnosticMode = (mode: PlayableModeRoute): boolean => mode === 'anagrams' || mode === 'translation' || mode === 'sprint' || mode === 'memory' || mode === 'letter_square';
const randomWordLength = (): WordLength => ([4, 5, 6] as WordLength[])[Math.floor(Math.random() * 3)];
const toAnalyticsGameType = (mode: PlayableModeRoute): GameRewardType => mode === 'game' ? 'wordle' : mode === 'anagrams' ? 'anagram' : mode === 'translation' ? 'translation' : mode === 'letter_square' ? 'letterSquare' : mode;
const toWordLedgerMode = (route: ViewState): string => route === 'game' ? 'wordle' : route === 'anagrams' ? 'anagram' : route === 'letter_square' ? 'letterSquare' : route;
const getWordleHintBalanceDelta = (): number => -WORDLE_HINT_COST;
const hasStoredBackendSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try { return Boolean(window.localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)); }
  catch { return false; }
};

const addRewardToStats = (stats: UserStats, input: GameRewardInput): UserStats => {
  if (input.statsOnly) return stats;
  return {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    gamesWon: stats.gamesWon + (input.won === true || (input.type !== 'wordle' && (input.guessedWords || 0) > 0) ? 1 : 0),
  };
};
const addPracticeWordToStats = (stats: UserStats, word: string, result: WordPracticeResult): UserStats => {
  const normalizedWord = normalizePracticeWord(word);
  if (!normalizedWord) return stats;
  const mastered = result === 'mastered';
  const now = new Date().toISOString();
  const previousPerformance = stats.wordPerformance?.[normalizedWord] || { word: normalizedWord, attempts: 0, correct: 0, mistakes: 0 };
  const wordsGuessed = { ...stats.wordsGuessed };
  if (mastered) wordsGuessed[normalizedWord] = (wordsGuessed[normalizedWord] || 0) + 1;
  const wordsToReview = updateReviewPriorities(stats.wordsToReview || {}, normalizedWord, result);
  return {
    ...stats,
    wordsGuessed,
    wordsToReview,
    wordLearningHistory: updateWordLearningHistory(stats, normalizedWord, result, wordsToReview, now),
    wordPerformance: {
      ...(stats.wordPerformance || {}),
      [normalizedWord]: {
        ...previousPerformance,
        attempts: previousPerformance.attempts + 1,
        correct: previousPerformance.correct + (mastered ? 1 : 0),
        mistakes: previousPerformance.mistakes + (mastered ? 0 : 1),
        lastPracticedAt: now,
      },
    },
  };
};
const hasInitialOAuthCode = (): boolean => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('oauth_code');
const rememberPaymentOrder = (orderId: string | null): void => { if (!orderId || typeof window === 'undefined') return; try { window.localStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, orderId); } catch { /* ignore */ } };
const paymentReturnStatus = (value: string | null): 'success' | 'pending' | 'error' | 'fail' | null => normalizePaymentReturnStatus(value);
const rememberPendingRoute = (route: ViewState): void => { if (typeof window === 'undefined' || route === 'landing') return; try { window.sessionStorage.setItem(PENDING_ROUTE_STORAGE_KEY, route); } catch { /* ignore */ } };
const consumePendingRoute = (): ViewState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_ROUTE_STORAGE_KEY) as ViewState | null;
    if (value) window.sessionStorage.removeItem(PENDING_ROUTE_STORAGE_KEY);
    return value;
  } catch { return null; }
};

const AppV2: React.FC = () => {
  const [initialLocation] = useState(() => getInitialClientLocation());
  const [route, setRouteState] = useState<ViewState>(initialLocation.route);
  const [entryPath, setEntryPathState] = useState<ClientEntryPath>(initialLocation.entryPath);
  const routeRef = useRef<ViewState>(initialLocation.route);
  const entryPathRef = useRef<ClientEntryPath>(initialLocation.entryPath);
  const [selectedPlayMode, setSelectedPlayMode] = useState<PlayableModeRoute>('game');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [dailyQuest, setDailyQuest] = useState<DailyQuestState | null>(null);
  const [dailyQuestReward, setDailyQuestReward] = useState<DailyQuestCompletionReward | null>(null);
  const [rewardEducation, setRewardEducation] = useState<RewardEducationKind | null>(null);
  const [blockGuestShellOnBootstrap] = useState(() => hasInitialOAuthCode() || (initialLocation.entryPath !== 'home' && hasStoredBackendSession()));
  const authProfile = useAuthProfile();
  const { bootstrapStatus, bootstrapError, settings, setSettings, userProfile, setUserProfile, setUserProfileForUser, isCurrentProfileOwner, currentUser, cachedUserId, isAuthenticated, authMode, tempUsername, setTempUsername, tempPassword, setTempPassword, authError, setAuthError, registrationConfirmationEmail, clearRegistrationConfirmation, isAuthLoading, openLoginMode, openRegisterMode, submitEmailAuth, loginWithYandex, logout } = authProfile;
  const currentUserId = currentUser?.id ?? cachedUserId ?? null;
  const { getSecretWordPool, getValidationPool, getModeWords, getWordTranslation } = useDictionaryPools({ settings, userProfile });
  const setProfileForRenderOwner = useCallback((next: UserProfile | ((previous: UserProfile) => UserProfile)): void => {
    if (currentUserId) setUserProfileForUser(currentUserId, next);
    else setUserProfile(next);
  }, [currentUserId, setUserProfile, setUserProfileForUser]);
  const profileEconomy = useProfileEconomy({ currentUserId, userProfile, setUserProfile: setProfileForRenderOwner });
  const wordReviewStatsRef = useRef<UserStats>(userProfile.stats);
  const wordPracticeSyncRef = useRef<Promise<void>>(Promise.resolve());
  const registrationIntentApplyingRef = useRef(false);
  const isAdmin = userProfile.role === 'admin';
  const isTeacher = userProfile.accountMode === 'teacher' || userProfile.role === 'teacher';
  const isKids = userProfile.accountMode === 'parent' || userProfile.role === 'parent';
  const isPractice = userProfile.accountMode === 'player' && userProfile.role !== 'parent' && userProfile.role !== 'teacher';
  const canUseDailyQuest = isAuthenticated && (isPractice || (isKids && userProfile.pet.characterOnboarded));
  const hasKidsProfileShell = Boolean(userProfile.childDisplayName || userProfile.childShareCode || userProfile.pet.characterOnboarded);

  useEffect(() => { wordReviewStatsRef.current = userProfile.stats; }, [userProfile.stats]);

  const setRoute = useCallback((next: ViewState) => {
    routeRef.current = next;
    setRouteState(next);
    if (typeof window !== 'undefined') {
      const path = pathForClientRoute(next, entryPathRef.current);
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
    }
  }, []);
  const replaceRoute = useCallback((next: ViewState) => {
    routeRef.current = next;
    setRouteState(next);
    if (typeof window !== 'undefined') {
      const path = pathForClientRoute(next, entryPathRef.current);
      if (window.location.pathname !== path) window.history.replaceState({}, '', path);
    }
  }, []);
  const setEntryPath = useCallback((next: ClientEntryPath) => {
    entryPathRef.current = next;
    setEntryPathState(next);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = routeForClientPath(window.location.pathname);
      routeRef.current = next.route;
      entryPathRef.current = next.entryPath;
      setRouteState(next.route);
      setEntryPathState(next.entryPath);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    analyticsService.trackEvent({ userId: currentUserId, eventType: 'navigation', eventName: 'route_changed', route, payload: { path: analyticsRouteForPath(window.location.pathname) } });
  }, [currentUserId, route]);

  useEffect(() => {
    if (bootstrapStatus !== 'ready') return;
    const intent = readRegistrationIntent();
    if (!intent || registrationIntentApplyingRef.current) return;
    const accountMode: AccountMode = intent === 'kids' ? 'parent' : intent === 'teacher' ? 'teacher' : 'player';
    if (userProfile.accountMode === accountMode) { clearRegistrationIntent(); return; }
    if (!isAuthenticated || userProfile.accountMode) return;
    registrationIntentApplyingRef.current = true;
    void familyAccountService.setAccountMode(accountMode).then(profile => {
      if (!isCurrentProfileOwner(currentUserId)) return;
      setUserProfile(profile);
      clearRegistrationIntent();
    }).catch(error => console.error('Failed to apply registration intent', error)).finally(() => { registrationIntentApplyingRef.current = false; });
  }, [bootstrapStatus, currentUserId, isAuthenticated, isCurrentProfileOwner, setUserProfile, userProfile.accountMode]);

  useEffect(() => {
    if (bootstrapStatus !== 'ready') return;
    if (isAdmin) { if (route !== 'admin' && route !== 'landing') replaceRoute('admin'); return; }
    if (!isAuthenticated) {
      if (route !== 'landing' && route !== 'premium') replaceRoute('landing');
      return;
    }
    if (userProfile.accountMode === 'parent' && !hasKidsProfileShell && route !== 'family_setup') { replaceRoute('family_setup'); return; }
    if (userProfile.accountMode === 'parent' && hasKidsProfileShell && !userProfile.pet.characterOnboarded && route !== 'character_onboarding') { replaceRoute('character_onboarding'); return; }
    if (isTeacher) {
      if (route !== 'landing' && route !== 'adult_room' && route !== 'dictionary_studio' && route !== 'profile') replaceRoute('adult_room');
      return;
    }
    if (entryPath === 'home' && route === 'landing') return;
    if (isPractice && (route === 'account_mode_setup' || route === 'family_setup' || route === 'character_onboarding')) replaceRoute('landing');
  }, [bootstrapStatus, entryPath, hasKidsProfileShell, isAuthenticated, isKids, isPractice, isTeacher, replaceRoute, route, userProfile.accountMode, userProfile.pet.characterOnboarded, userProfile.role]);
  useEffect(() => {
    if (bootstrapStatus !== 'ready' || !isAuthenticated || isTeacher) return;
    if (settings.dictionarySource === 'custom' && userProfile.customDictionaryEn.length === 0 && (userProfile.assignedWords || []).length === 0) {
      setSettings(previous => ({ ...previous, dictionarySource: 'builtin', useCustomDictionary: false }));
    }
  }, [bootstrapStatus, isAuthenticated, isTeacher, setSettings, settings.dictionarySource, userProfile.assignedWords, userProfile.customDictionaryEn.length]);
  useEffect(() => {
    if (bootstrapStatus !== 'ready' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = paymentReturnStatus(params.get('payment'));
    if (!payment) return;
    const orderId = params.get('order_id') || params.get('orderId') || params.get('order_num');
    rememberPaymentOrder(orderId);
    replaceRoute(payment === 'fail' || payment === 'error' ? 'premium' : 'premium_success');
  }, [bootstrapStatus, replaceRoute]);

  const loadDailyQuest = useCallback(async () => {
    if (bootstrapStatus !== 'ready' || !canUseDailyQuest) { setDailyQuest(null); return; }
    try { setDailyQuest(await dailyQuestService.getTodayQuest()); }
    catch (error) { console.error('Failed to load daily quest', error); }
  }, [bootstrapStatus, canUseDailyQuest]);
  useEffect(() => {
    void loadDailyQuest();
    if (bootstrapStatus !== 'ready' || !canUseDailyQuest || typeof window === 'undefined' || typeof document === 'undefined') return;
    const refreshVisibleQuest = () => { if (document.visibilityState === 'visible') void loadDailyQuest(); };
    window.addEventListener('focus', refreshVisibleQuest);
    document.addEventListener('visibilitychange', refreshVisibleQuest);
    const intervalId = window.setInterval(refreshVisibleQuest, 60_000);
    return () => { window.removeEventListener('focus', refreshVisibleQuest); document.removeEventListener('visibilitychange', refreshVisibleQuest); window.clearInterval(intervalId); };
  }, [bootstrapStatus, canUseDailyQuest, loadDailyQuest]);
  const closeAuthModal = useCallback(() => { clearRegistrationIntent(); setShowLoginModal(false); }, []);
  const openLogin = useCallback(() => { openLoginMode(); setShowLoginModal(true); }, [openLoginMode]);
  const openRegister = useCallback((path?: 'practice' | 'kids' | 'teacher') => { if (path) { rememberRegistrationIntent(path); setEntryPath(path); } else clearRegistrationIntent(); openRegisterMode(); setShowLoginModal(true); }, [openRegisterMode, setEntryPath]);
  const updateEmail = useCallback((value: string) => { if (authError) setAuthError(null); setTempUsername(value); }, [authError, setAuthError, setTempUsername]);
  const updatePassword = useCallback((value: string) => { if (authError) setAuthError(null); setTempPassword(value); }, [authError, setAuthError, setTempPassword]);
  const handleAuthModeChange = useCallback((mode: 'login' | 'register') => { if (mode === 'login') openLoginMode(); else openRegisterMode(); }, [openLoginMode, openRegisterMode]);
  const handleLogout = useCallback(async () => {
    analyticsService.trackEvent({ userId: currentUserId, eventType: 'auth', eventName: 'logout', route });
    await analyticsService.flush();
    await logout();
    clearRegistrationIntent();
    setDailyQuest(null);
    setDailyQuestReward(null);
    setEntryPath('home');
    setRoute('landing');
  }, [currentUserId, logout, route, setEntryPath, setRoute]);
  const submitDailyQuestResult = useCallback(async (input: GameRewardInput) => {
    if (!canUseDailyQuest) return;
    const optimistic = isKids && doesGameResultCompleteDailyQuest(dailyQuest, input);
    if (optimistic && dailyQuest) {
      const optimisticQuest = { ...dailyQuest, completed: true, completedAt: new Date().toISOString(), rewardItemId: dailyQuest.rewardItemId || null };
      setDailyQuestReward({ quest: optimisticQuest, item: null, worldId: null, pending: true });
    }
    try {
      const result = await dailyQuestService.submitGameResult(input);
      setDailyQuest(result.quest);
      if (result.profile && currentUserId) setUserProfileForUser(currentUserId, result.profile);
      if (isKids) setDailyQuestReward(result.reward ? { ...result.reward, pending: false } : null);
    } catch (error) {
      if (optimistic) setDailyQuestReward(null);
      console.error('Failed to apply daily quest result', error);
    }
  }, [canUseDailyQuest, currentUserId, dailyQuest, isKids, setUserProfileForUser]);
  const sendWordLedgerEvent = useCallback((word: string, result: WordPracticeResult, mode: string, routeName: string = route) => {
    if (!currentUserId) return;
    const event = gameEventLedgerService.createWordPracticeEvent(currentUserId, word, result, { gameMode: mode, wordLength: mode === 'sprint' || mode === 'translation' || mode === 'letterSquare' || mode === 'anagram' ? 'any' : settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty, route: routeName });
    if (!event) return;
    void gameEventLedgerService.sendNow([event]).catch(error => console.error('Failed to record word-level ledger event', error));
  }, [currentUserId, route, settings.dictionarySource, settings.difficulty, settings.wordLength]);
  const updateClassicStats = useCallback(async (won: boolean, word: string, coinsAdjustment = 0) => {
    const nextStats = addPracticeWordToStats(userProfile.stats, word, won ? 'mastered' : 'failed');
    nextStats.gamesPlayed += 1;
    if (won) nextStats.gamesWon += 1;
    const event = analyticsService.createEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: 'wordle', route: 'game', payload: { won, word, coinsAdjustment: isKids ? coinsAdjustment : 0, wordLength: settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty } });
    sendWordLedgerEvent(word, won ? 'mastered' : 'failed', 'wordle', 'game');
    if (!isKids) {
      await profileEconomy.updateStats(nextStats);
      analyticsService.trackEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: 'wordle', route: 'game', payload: event.payload });
      return;
    }
    await profileEconomy.applyGameReward({ type: 'wordle', won, coinsAdjustment }, { stats: nextStats, analyticsEvents: [event] });
  }, [currentUserId, isKids, profileEconomy, sendWordLedgerEvent, settings.dictionarySource, settings.difficulty, settings.wordLength, userProfile.stats]);
  const submitClassicDailyQuestResult = useCallback(async (won: boolean, _word: string, attempts: number) => submitDailyQuestResult({ type: 'wordle', won, attempts }), [submitDailyQuestResult]);
  const chargeWordleHint = useCallback(async (): Promise<boolean> => {
    if (!isKids) return true;
    if (userProfile.coins < WORDLE_HINT_COST) return false;
    await profileEconomy.adjustCoinsStrict(getWordleHintBalanceDelta());
    return true;
  }, [isKids, profileEconomy, userProfile.coins]);
  const refundWordleHint = useCallback(async (): Promise<void> => {
    if (!isKids) return;
    await profileEconomy.adjustCoinsStrict(WORDLE_HINT_COST);
  }, [isKids, profileEconomy]);
  const chargeDictionaryPeek = useCallback(async (): Promise<boolean> => {
    if (!isKids) return true;
    if (userProfile.coins < WORDLE_HINT_COST) return false;
    await profileEconomy.adjustCoinsStrict(getWordleHintBalanceDelta());
    return true;
  }, [isKids, profileEconomy, userProfile.coins]);
  const classicGame = useClassicGameController({ route, settings, sessionOwnerId: currentUserId, getSecretWordPool, getValidationPool, getModeWords, getWordTranslation, onRouteChange: setRoute, onStatsUpdate: updateClassicStats, onDailyQuestResult: submitClassicDailyQuestResult, availableCoins: isKids ? userProfile.coins : Number.MAX_SAFE_INTEGER, onHintCharge: chargeWordleHint, onHintRefund: refundWordleHint });
  const modeIgnoresWordLength = route === 'setup' ? isLengthAgnosticMode(selectedPlayMode) : route === 'anagrams' || route === 'translation' || route === 'sprint' || route === 'memory' || route === 'letter_square';
  const modeWords = useMemo(() => getModeWords({ respectWordLength: !modeIgnoresWordLength }), [getModeWords, modeIgnoresWordLength]);
  const activeDictionaryWordCount = useMemo(() => getModeWords({ respectWordLength: false }).length, [getModeWords]);
  const handleBuy = useCallback(async (item: ShopItem) => { if (!isKids) return; return profileEconomy.buyItem(item); }, [isKids, profileEconomy]);
  const handleUseItem = useCallback(async (itemId: string) => { if (!isKids) return; return profileEconomy.useItem(itemId); }, [isKids, profileEconomy]);
  const handleSaveDictionary = useCallback(async (draft: PremiumDictionaryDraft) => {
    const requestUserId = currentUserId;
    const collection = await premiumDictionaryService.saveCollection(draft);
    if (!requestUserId || !isCurrentProfileOwner(requestUserId)) return;
    setUserProfileForUser(requestUserId, previous => ({ ...previous, customDictionaryEn: previous.role === 'teacher' ? previous.customDictionaryEn : collection.words, dictionaryCollections: [collection, ...(previous.dictionaryCollections || []).filter(item => item.id !== collection.id)] }));
    if (!isTeacher) setSettings(previous => ({ ...previous, dictionarySource: 'custom', useCustomDictionary: true }));
  }, [currentUserId, isCurrentProfileOwner, isTeacher, setSettings, setUserProfileForUser]);
  const handleTestUnlockPremium = useCallback(() => {
    setUserProfile(previous => ({ ...previous, subscriptionTier: 'premium', premiumExpiresAt: undefined, featureFlags: { ...(previous.featureFlags || {}), premiumDictionaries: true } }));
    setSettings(previous => ({ ...previous, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: previous.activePremiumDictionaryId || getDefaultPremiumDictionaryId() }));
  }, [setSettings, setUserProfile]);
  const handleSelectAccountMode = useCallback(async (mode: AccountMode) => { const requestUserId = currentUserId; const updated = await familyAccountService.setAccountMode(mode); if (!requestUserId || !isCurrentProfileOwner(requestUserId)) return; setUserProfile(updated); setEntryPath(mode === 'parent' ? 'kids' : mode === 'teacher' ? 'teacher' : 'practice'); replaceRoute(mode === 'parent' ? 'family_setup' : 'landing'); }, [currentUserId, isCurrentProfileOwner, replaceRoute, setEntryPath, setUserProfile]);
  const handleCreateChild = useCallback(async (childName: string, pin: string): Promise<ChildSetupResult> => {
    const requestUserId = currentUserId;
    const result = await familyAccountService.createChild(childName, pin);
    if (!requestUserId || !isCurrentProfileOwner(requestUserId)) throw new Error('Аккаунт изменился во время сохранения. Повторите настройку.');
    return result;
  }, [currentUserId, isCurrentProfileOwner]);
  const handleChildSetupComplete = useCallback((result: ChildSetupResult) => {
    setEntryPath('kids');
    setUserProfile(previous => ({ ...previous, role: 'parent', accountMode: 'parent', childDisplayName: result.childName, childShareCode: result.childShareCode, childSlotsLimit: result.childSlotsLimit, featureFlags: { ...(previous.featureFlags || {}), adultRoom: true } }));
    setRoute('character_onboarding');
  }, [setEntryPath, setRoute, setUserProfile]);
  const handleGameReward = useCallback(async (input: GameRewardInput) => {
    const event = analyticsService.createEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: input.type, route: input.type === 'other' ? route : input.type, payload: { ...input, wordLength: settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty } });
    const nextStats = addRewardToStats(wordReviewStatsRef.current, input);
    if (nextStats !== wordReviewStatsRef.current) wordReviewStatsRef.current = nextStats;
    if (!isKids) {
      analyticsService.trackEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_finished', gameType: input.type, route: input.type === 'other' ? route : input.type, payload: event.payload });
      if (nextStats !== userProfile.stats) await profileEconomy.updateStats(nextStats);
      if (!input.statsOnly) await submitDailyQuestResult(input);
      return;
    }
    const reward = calculateGameReward(input);
    const showCoins = userProfile.coins <= 0 && reward.coins > 0 && !readRewardEducation(currentUserId, 'coins');
    const showXp = (userProfile.pet.xp || 0) <= 0 && reward.xp > 0 && !readRewardEducation(currentUserId, 'xp');
    await profileEconomy.applyGameReward(input, { stats: nextStats, analyticsEvents: [event] });
    if (!input.statsOnly) await submitDailyQuestResult(input);
    if (showCoins || showXp) {
      const kind: RewardEducationKind = showCoins && showXp ? 'coins_and_xp' : showCoins ? 'coins' : 'xp';
      markRewardEducation(currentUserId, kind);
      setRewardEducation(kind);
    }
  }, [currentUserId, isKids, profileEconomy, route, settings.dictionarySource, settings.difficulty, settings.wordLength, submitDailyQuestResult, userProfile.coins, userProfile.pet.xp, userProfile.stats]);
  const handleWordPractice = useCallback(async (word: string, result: WordPracticeResult) => {
    const previousStats = wordReviewStatsRef.current;
    const nextStats = addPracticeWordToStats(previousStats, word, result);
    wordReviewStatsRef.current = nextStats;
    sendWordLedgerEvent(word, result, toWordLedgerMode(route));
    wordPracticeSyncRef.current = wordPracticeSyncRef.current.catch(() => undefined).then(() => profileEconomy.updateStats(nextStats));
    await wordPracticeSyncRef.current;
  }, [profileEconomy, route, sendWordLedgerEvent]);
  const handleCharacterOnboardingComplete = useCallback(async (character: PetState) => { const requestUserId = currentUserId; await profileEconomy.updateCharacter(character); if (!requestUserId || !isCurrentProfileOwner(requestUserId)) return; analyticsService.trackEvent({ userId: requestUserId, eventType: 'character', eventName: 'character_selected', route: 'character_onboarding', payload: { characterType: character.type } }); replaceRoute('landing'); }, [currentUserId, isCurrentProfileOwner, profileEconomy, replaceRoute]);
  const startTrackedGame = useCallback((mode: PlayableModeRoute) => {
    analyticsService.trackEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_started', gameType: toAnalyticsGameType(mode), route: mode, payload: { wordLength: isLengthAgnosticMode(mode) ? 'any' : settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty, wordsAvailable: modeWords.length } });
  }, [currentUserId, modeWords.length, settings.dictionarySource, settings.difficulty, settings.wordLength]);
  const canRenderWhileBootstrapping = bootstrapStatus === 'loading' && !blockGuestShellOnBootstrap && (route === 'landing' || Boolean(userProfile.accountMode) || userProfile.role === 'admin');
  if (bootstrapStatus === 'error') return <AuthBootstrapGate error={bootstrapError} onRetry={() => window.location.reload()} />;
  if (bootstrapStatus !== 'ready' && !canRenderWhileBootstrapping) return <AuthBootstrapGate mode="blocking" />;
  const shell = <AppShell route={route} userProfile={userProfile} isAuthenticated={isAuthenticated} showLoginModal={showLoginModal} showRulesModal={showRulesModal} authMode={authMode} tempUsername={tempUsername} tempPassword={tempPassword} authError={authError} isAuthLoading={isAuthLoading} onHomeClick={() => { setEntryPath('home'); setRoute('landing'); }} onLoginClick={openLogin} onLogoutClick={handleLogout} onProfileClick={() => setRoute('profile')} onShopClick={() => setRoute('shop')} onAdminClick={() => setRoute('admin')} onAdultRoomClick={() => setRoute('adult_room')} onDictionaryStudioClick={() => setRoute(isTeacher ? 'dictionary_studio' : 'dictionary_settings')} onCloseLogin={closeAuthModal} onCloseRules={() => setShowRulesModal(false)} onAuthModeChange={handleAuthModeChange} onUsernameChange={updateEmail} onPasswordChange={updatePassword} onAuthSubmit={submitEmailAuth} onYandexLogin={loginWithYandex}><AppScreens route={route} entryPath={entryPath} selectedPlayMode={selectedPlayMode} userProfile={userProfile} isAuthenticated={isAuthenticated} sessionOwnerId={currentUserId} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={() => setDailyQuestReward(null)} settings={settings} modeWords={modeWords} activeDictionaryWordCount={activeDictionaryWordCount} classicGame={classicGame} dictionaryUpload={{ isUploadingDictionary: dictionaryUpload.isUploadingDictionary, error: dictionaryUpload.dictionaryUploadError, onFileUpload: dictionaryUpload.handleDictionaryFileUpload }} onRouteChange={setRoute} onEntryPathChange={setEntryPath} onSelectedPlayModeChange={setSelectedPlayMode} onSettingsChange={setSettings} onOpenLogin={openLogin} onOpenRegister={openRegister} onOpenRules={() => setShowRulesModal(true)} onBuy={handleBuy} onUseItem={handleUseItem} onUpdatePet={profileEconomy.updateCharacter} onSaveDictionary={handleSaveDictionary} onSelectAccountMode={handleSelectAccountMode} onCreateChild={handleCreateChild} onChildSetupComplete={handleChildSetupComplete} onGameReward={handleGameReward} onWordPractice={handleWordPractice} onCharacterOnboardingComplete={handleCharacterOnboardingComplete} onGameStarted={startTrackedGame} onTestUnlockPremium={handleTestUnlockPremium} onDictionaryPeek={chargeDictionaryPeek} /></AppShell>;
  const rewardEducationDescription = rewardEducation === 'coins_and_xp'
    ? <>Монеты нужны для лакомств, предметов и подсказок. Опыт повышает уровень питомца и открывает новые возможности.</>
    : rewardEducation === 'coins'
      ? <>Монеты можно тратить в магазине на лакомства и предметы для питомца, а также на некоторые подсказки в играх.</>
      : <>Опыт растёт после игр, повышает уровень питомца и постепенно открывает новые возможности.</>;
  return <>{shell}{bootstrapStatus === 'loading' && <AuthBootstrapGate mode="inline" />}
    <InfoModal open={Boolean(registrationConfirmationEmail)} eyebrow="Проверьте почту" title="Подтвердите регистрацию" description={<>Мы отправили письмо на <strong>{registrationConfirmationEmail}</strong>. Откройте ссылку из письма — после этого аккаунт будет создан и выбранный формат сохранится.</>} actionLabel="Хорошо" onClose={clearRegistrationConfirmation} />
    <InfoModal open={Boolean(rewardEducation)} eyebrow="Первая награда" title={rewardEducation === 'coins_and_xp' ? 'Монеты и опыт' : rewardEducation === 'coins' ? 'Что такое монеты?' : 'Что такое опыт?'} description={rewardEducationDescription} onClose={() => setRewardEducation(null)} />
  </>;
};
export default AppV2;
