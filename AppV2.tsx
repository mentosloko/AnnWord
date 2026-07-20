import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AppScreens, PlayableModeRoute } from './components/AppScreens';
import { AuthBootstrapGate } from './components/AuthBootstrapGate';
import { useAuthProfile } from './hooks/useAuthProfile';
import { useClassicGameController } from './hooks/useClassicGameController';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useDictionaryUpload } from './hooks/useDictionaryUpload';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { AccountMode, DailyQuestCompletionReward, DailyQuestState, DictionarySource, GameRewardType, PetState, ShopItem, UserStats, ViewState, WordLearningHistory } from './types';
import { analyticsService } from './services/analyticsService';
import { GameRewardInput } from './services/gamificationRules';
import { updateReviewPriorities, WordPracticeResult } from './services/gameSessionEngine';
import { preloadAppAssetsForProfile } from './services/assetPreloader';
import { WORDLE_HINT_COST, getWordleHintBalanceDelta } from './services/wordleEconomy';
import { dailyQuestService } from './services/dailyQuestService';
import { doesGameResultCompleteDailyQuest } from './services/dailyQuest';
import { pickDailyQuestTreat } from './services/dailyQuestRewardCatalog';
import { premiumDictionaryService, PremiumDictionaryDraft } from './services/premiumDictionaryService';
import { ChildSetupResult, familyAccountService } from './services/familyAccountService';
import { getDefaultPremiumDictionaryId } from './services/premiumDictionaryCatalog';
import { ClientEntryPath } from './services/clientEntryPath';
import { getClientLocationFromPathname, getClientRouteUrl, getInitialClientLocation } from './services/clientRoute';
import { gameEventLedgerService } from './services/gameEventLedgerService';

const LENGTH_AGNOSTIC_MODES = new Set<PlayableModeRoute>(['anagrams', 'translation', 'sprint', 'memory', 'letter_square']);
const PAYMENT_ORDER_STORAGE_KEY = 'annword_pending_payment_order_id';
const PENDING_ROUTE_STORAGE_KEY = 'annword_pending_route_v1';
const isLengthAgnosticMode = (mode: PlayableModeRoute): boolean => LENGTH_AGNOSTIC_MODES.has(mode);
const toAnalyticsGameType = (mode: PlayableModeRoute): GameRewardType => mode === 'game' ? 'wordle' : mode === 'anagrams' ? 'anagram' : mode === 'letter_square' ? 'letterSquare' : mode;
const toWordLedgerMode = (route: ViewState): string => route === 'game' ? 'wordle' : route === 'anagrams' ? 'anagram' : route === 'letter_square' ? 'letterSquare' : route;
const isRewardStatWin = (input: GameRewardInput): boolean => {
  if ('wonForStats' in input && typeof input.wonForStats === 'boolean') return input.wonForStats;
  if (input.type === 'wordle' || input.type === 'hangman') return Boolean(input.won);
  if (input.type === 'sprint' || input.type === 'anagram' || input.type === 'translation' || input.type === 'letterSquare') return Math.max(0, Math.round(input.guessedWords || 0)) > 0;
  if (input.type === 'memory') return Math.max(0, Math.round(input.clicks || 0)) > 0;
  return false;
};
const shouldCountRewardInStats = (input: GameRewardInput): boolean => input.type !== 'other' && (input.type !== 'anagram' || Boolean(input.statsOnly));
const addRewardToStats = (stats: UserStats, input: GameRewardInput): UserStats => {
  if (!shouldCountRewardInStats(input)) return stats;
  const next: UserStats = {
    ...stats,
    wordsGuessed: { ...stats.wordsGuessed },
    wordsToReview: { ...(stats.wordsToReview || {}) },
    wordPerformance: stats.wordPerformance ? { ...stats.wordPerformance } : undefined,
    wordLearningHistory: stats.wordLearningHistory ? { ...stats.wordLearningHistory } : undefined,
  };
  next.gamesPlayed += 1;
  if (isRewardStatWin(input)) next.gamesWon += 1;
  return next;
};
const normalizePracticeWord = (word: string) => word.trim().toUpperCase();
const MAX_WORD_HISTORY_EVENTS = 80;
const updateWordLearningHistory = (stats: UserStats, word: string, result: WordPracticeResult, nextReview: Record<string, number>, at: string): Record<string, WordLearningHistory> => {
  const mastered = result === 'mastered';
  const previous = stats.wordLearningHistory?.[word] || { word, mistakeCount: 0, resolvedCount: 0, currentReviewPriority: Math.max(0, Math.round(stats.wordsToReview?.[word] || 0)), events: [] };
  const previousPriority = Math.max(0, Math.round(stats.wordsToReview?.[word] ?? previous.currentReviewPriority ?? 0));
  const nextPriority = Math.max(0, Math.round(nextReview[word] || 0));
  const wasDifficult = previousPriority > 0 || previous.mistakeCount > 0;
  const eventType = mastered ? (wasDifficult ? 'resolved' : 'mastered') : 'mistake';
  const nextEvents = [...(previous.events || []), { at, type: eventType, reviewPriorityAfter: nextPriority }].slice(-MAX_WORD_HISTORY_EVENTS);
  return {
    ...(stats.wordLearningHistory || {}),
    [word]: {
      ...previous,
      word,
      firstMistakeAt: !mastered && !previous.firstMistakeAt ? at : previous.firstMistakeAt,
      lastMistakeAt: mastered ? previous.lastMistakeAt : at,
      lastResolvedAt: mastered && wasDifficult ? at : previous.lastResolvedAt,
      mistakeCount: previous.mistakeCount + (mastered ? 0 : 1),
      resolvedCount: previous.resolvedCount + (mastered && wasDifficult ? 1 : 0),
      currentReviewPriority: nextPriority,
      events: nextEvents,
    },
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
const paymentReturnStatus = (value: string | null): 'success' | 'pending' | 'error' | 'fail' | null => value === 'success' || value === 'pending' || value === 'error' || value === 'fail' ? value : null;
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
  const [blockGuestShellOnBootstrap] = useState(() => hasInitialOAuthCode());
  const authProfile = useAuthProfile();
  const { bootstrapStatus, bootstrapError, settings, setSettings, userProfile, setUserProfile, currentUser, cachedUserId, isAuthenticated, authMode, tempUsername, setTempUsername, tempPassword, setTempPassword, authError, setAuthError, isAuthLoading, openLoginMode, openRegisterMode, submitEmailAuth, loginWithYandex, logout } = authProfile;
  const currentUserId = currentUser?.id ?? cachedUserId ?? null;
  const { getSecretWordPool, getValidationPool, getModeWords } = useDictionaryPools({ settings, userProfile });
  const profileEconomy = useProfileEconomy({ currentUserId, userProfile, setUserProfile });
  const wordReviewStatsRef = useRef<UserStats>(userProfile.stats);
  const wordPracticeSyncRef = useRef<Promise<void>>(Promise.resolve());
  const isAdmin = userProfile.role === 'admin';
  const isTeacher = userProfile.accountMode === 'teacher' || userProfile.role === 'teacher';
  const isKids = userProfile.accountMode === 'parent' || userProfile.role === 'parent';
  const isPractice = userProfile.accountMode === 'player' && userProfile.role !== 'parent' && userProfile.role !== 'teacher';
  const canUseDailyQuest = isAuthenticated && (isPractice || (isKids && userProfile.pet.characterOnboarded));
  const hasKidsProfileShell = Boolean(userProfile.childDisplayName || userProfile.childShareCode || userProfile.pet.characterOnboarded);

  const writeRouteUrl = useCallback((nextRoute: ViewState, nextEntryPath: ClientEntryPath, replace = false) => {
    if (typeof window === 'undefined') return;
    const nextUrl = getClientRouteUrl(nextRoute, nextEntryPath);
    if (window.location.pathname === nextUrl && !window.location.search) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl);
  }, []);

  const navigateRoute = useCallback((nextRoute: ViewState, replace = false) => {
    const previousRoute = routeRef.current;
    routeRef.current = nextRoute;
    setRouteState(nextRoute);
    writeRouteUrl(nextRoute, entryPathRef.current, replace);
    if (previousRoute !== nextRoute) {
      analyticsService.trackEvent({ userId: currentUserId, eventType: 'navigation', eventName: 'route_changed', route: nextRoute, payload: { previousRoute, nextRoute } });
      if (typeof window !== 'undefined') window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    }
  }, [currentUserId, writeRouteUrl]);
  const setRoute = useCallback((nextRoute: ViewState) => navigateRoute(nextRoute, false), [navigateRoute]);
  const replaceRoute = useCallback((nextRoute: ViewState) => navigateRoute(nextRoute, true), [navigateRoute]);

  const setEntryPath = useCallback((nextEntryPath: ClientEntryPath) => {
    entryPathRef.current = nextEntryPath;
    setEntryPathState(nextEntryPath);
    if (routeRef.current === 'landing') writeRouteUrl('landing', nextEntryPath, false);
  }, [writeRouteUrl]);

  useEffect(() => {
    const onPopState = () => {
      const next = getClientLocationFromPathname(window.location.pathname);
      routeRef.current = next.route;
      entryPathRef.current = next.entryPath;
      setRouteState(next.route);
      setEntryPathState(next.entryPath);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => { wordReviewStatsRef.current = userProfile.stats; }, [userProfile.stats]);
  const goRoot = useCallback(() => { setEntryPath('home'); setRoute('landing'); }, [setEntryPath, setRoute]);
  const openDictionaryArea = useCallback(() => setRoute(isAdmin || isTeacher || isKids ? 'dictionary_studio' : 'dictionary_settings'), [isAdmin, isKids, isTeacher, setRoute]);
  const setDictionarySource = useCallback((source: DictionarySource) => setSettings(previous => ({ ...previous, dictionarySource: source, useCustomDictionary: source === 'custom' })), [setSettings]);
  const dictionaryUpload = useDictionaryUpload({ updateDictionary: profileEconomy.updateDictionary, setDictionarySource });

  useEffect(() => { if (isAuthenticated) setShowLoginModal(false); }, [isAuthenticated]);
  useEffect(() => { if (bootstrapStatus === 'ready' && isKids) preloadAppAssetsForProfile(userProfile); }, [bootstrapStatus, isKids, userProfile.pet.type, userProfile.pet.characterOnboarded]);
  useEffect(() => {
    if (bootstrapStatus !== 'ready') return;
    if (!isAuthenticated && routeRef.current !== 'landing') {
      rememberPendingRoute(routeRef.current);
      entryPathRef.current = 'home';
      setEntryPathState('home');
      replaceRoute('landing');
      return;
    }
    if (isAuthenticated && (userProfile.accountMode || userProfile.role === 'admin') && routeRef.current === 'landing') {
      const pending = consumePendingRoute();
      if (pending && pending !== 'landing') setRoute(pending);
    }
  }, [bootstrapStatus, isAuthenticated, replaceRoute, setRoute, userProfile.accountMode, userProfile.role]);
  useEffect(() => {
    if (bootstrapStatus !== 'ready' || !isAuthenticated) return;
    if (userProfile.role !== 'admin' && !userProfile.accountMode) {
      if (route !== 'account_mode_setup') replaceRoute('account_mode_setup');
      return;
    }
    if (isKids) {
      if (!hasKidsProfileShell) {
        if (route !== 'family_setup') replaceRoute('family_setup');
        return;
      }
      if (!userProfile.pet.characterOnboarded) {
        if (route !== 'character_onboarding' && route !== 'premium' && route !== 'premium_success') replaceRoute('character_onboarding');
        return;
      }
    }
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
  const openLogin = useCallback(() => { openLoginMode(); setShowLoginModal(true); }, [openLoginMode]);
  const openRegister = useCallback(() => { openRegisterMode(); setShowLoginModal(true); }, [openRegisterMode]);
  const updateEmail = useCallback((value: string) => { if (authError) setAuthError(null); setTempUsername(value); }, [authError, setAuthError, setTempUsername]);
  const updatePassword = useCallback((value: string) => { if (authError) setAuthError(null); setTempPassword(value); }, [authError, setAuthError, setTempPassword]);
  const handleAuthModeChange = useCallback((mode: 'login' | 'register') => { if (mode === 'login') openLoginMode(); else openRegisterMode(); }, [openLoginMode, openRegisterMode]);
  const handleLogout = useCallback(async () => {
    analyticsService.trackEvent({ userId: currentUserId, eventType: 'auth', eventName: 'logout', route });
    await analyticsService.flush();
    await logout();
    setDailyQuest(null);
    setDailyQuestReward(null);
    setEntryPath('home');
    setRoute('landing');
  }, [currentUserId, logout, route, setEntryPath, setRoute]);
  const submitDailyQuestResult = useCallback(async (input: GameRewardInput) => {
    if (!canUseDailyQuest) return;
    const optimistic = isKids && doesGameResultCompleteDailyQuest(dailyQuest, input);
    if (optimistic && dailyQuest) {
      const item = currentUserId ? pickDailyQuestTreat(currentUserId, dailyQuest.questDate) : null;
      const optimisticQuest = { ...dailyQuest, completed: true, completedAt: new Date().toISOString(), rewardItemId: item?.id || dailyQuest.rewardItemId || null };
      setDailyQuestReward({ quest: optimisticQuest, item, worldId: dailyQuest.rewardWorldId || null, pending: true });
    }
    try {
      const result = await dailyQuestService.submitGameResult(input);
      setDailyQuest(result.quest);
      if (result.profile) setUserProfile(result.profile);
      if (isKids) setDailyQuestReward(result.reward ? { ...result.reward, pending: false } : null);
    } catch (error) {
      if (optimistic) setDailyQuestReward(null);
      console.error('Failed to apply daily quest result', error);
    }
  }, [canUseDailyQuest, currentUserId, dailyQuest, isKids, setUserProfile]);
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
  const chargeWordleHint = useCallback(async (): Promise<boolean> => { if (!isKids) return true; if (userProfile.coins < WORDLE_HINT_COST) return false; await profileEconomy.winCoins(getWordleHintBalanceDelta()); return true; }, [isKids, profileEconomy, userProfile.coins]);
  const chargeDictionaryPeek = useCallback(async (): Promise<boolean> => chargeWordleHint(), [chargeWordleHint]);
  const classicGame = useClassicGameController({ route, settings, sessionOwnerId: currentUserId, getSecretWordPool, getValidationPool, getModeWords, onRouteChange: setRoute, onStatsUpdate: updateClassicStats, onDailyQuestResult: submitClassicDailyQuestResult, availableCoins: isKids ? userProfile.coins : Number.MAX_SAFE_INTEGER, onHintCharge: chargeWordleHint });
  const modeIgnoresWordLength = route === 'setup' ? isLengthAgnosticMode(selectedPlayMode) : route === 'anagrams' || route === 'translation' || route === 'sprint' || route === 'memory' || route === 'letter_square';
  const modeWords = useMemo(() => getModeWords({ respectWordLength: !modeIgnoresWordLength }), [getModeWords, modeIgnoresWordLength]);
  const activeDictionaryWordCount = useMemo(() => getModeWords({ respectWordLength: false }).length, [getModeWords]);
  const handleBuy = useCallback(async (item: ShopItem) => { if (!isKids) return; return profileEconomy.buyItem(item); }, [isKids, profileEconomy]);
  const handleUseItem = useCallback(async (itemId: string) => { if (!isKids) return; return profileEconomy.useItem(itemId); }, [isKids, profileEconomy]);
  const handleSaveDictionary = useCallback(async (draft: PremiumDictionaryDraft) => {
    const collection = await premiumDictionaryService.saveCollection(draft);
    setUserProfile(previous => ({ ...previous, customDictionaryEn: previous.role === 'teacher' ? previous.customDictionaryEn : collection.words, dictionaryCollections: [collection, ...(previous.dictionaryCollections || []).filter(item => item.id !== collection.id)] }));
    if (!isTeacher) setDictionarySource('custom');
  }, [isTeacher, setDictionarySource, setUserProfile]);
  const handleTestUnlockPremium = useCallback(() => {
    setUserProfile(previous => ({ ...previous, subscriptionTier: 'premium', premiumExpiresAt: undefined, featureFlags: { ...(previous.featureFlags || {}), premiumDictionaries: true } }));
    setSettings(previous => ({ ...previous, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: previous.activePremiumDictionaryId || getDefaultPremiumDictionaryId() }));
    setRoute('dictionary_settings');
  }, [setRoute, setSettings, setUserProfile]);
  const handleSelectAccountMode = useCallback(async (mode: AccountMode) => {
    await familyAccountService.selectAccountMode(mode);
    const nextEntryPath: ClientEntryPath = mode === 'parent' ? 'kids' : mode === 'teacher' ? 'teacher' : 'practice';
    setEntryPath(nextEntryPath);
    setUserProfile(previous => ({ ...previous, accountMode: mode, role: mode === 'parent' ? 'parent' : mode === 'teacher' ? 'teacher' : 'user', featureFlags: mode === 'player' ? previous.featureFlags : { ...(previous.featureFlags || {}), adultRoom: true } }));
    setRoute(mode === 'teacher' ? 'adult_room' : mode === 'parent' ? 'family_setup' : 'landing');
  }, [setEntryPath, setRoute, setUserProfile]);
  const handleCreateChild = useCallback(async (childName: string, pin: string): Promise<ChildSetupResult> => familyAccountService.createChild(childName, pin), []);
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
    const questPromise = !input.statsOnly ? submitDailyQuestResult(input) : Promise.resolve();
    await profileEconomy.applyGameReward(input, { stats: nextStats, analyticsEvents: [event] });
    await questPromise;
  }, [currentUserId, isKids, profileEconomy, route, settings.dictionarySource, settings.difficulty, settings.wordLength, submitDailyQuestResult, userProfile.stats]);
  const handleWordPractice = useCallback(async (word: string, result: WordPracticeResult) => {
    const previousStats = wordReviewStatsRef.current;
    const nextStats = addPracticeWordToStats(previousStats, word, result);
    wordReviewStatsRef.current = nextStats;
    sendWordLedgerEvent(word, result, toWordLedgerMode(route));
    wordPracticeSyncRef.current = wordPracticeSyncRef.current.catch(() => undefined).then(() => profileEconomy.updateStats(nextStats));
    await wordPracticeSyncRef.current;
  }, [profileEconomy, route, sendWordLedgerEvent]);
  const handleCharacterOnboardingComplete = useCallback(async (character: PetState) => { await profileEconomy.updateCharacter(character); setRoute('landing'); }, [profileEconomy, setRoute]);
  const startTrackedGame = useCallback((mode: PlayableModeRoute) => {
    analyticsService.trackEvent({ userId: currentUserId, eventType: 'game', eventName: 'game_started', gameType: toAnalyticsGameType(mode), route: mode, payload: { wordLength: isLengthAgnosticMode(mode) ? 'any' : settings.wordLength, dictionarySource: settings.dictionarySource, difficulty: settings.difficulty, wordsAvailable: modeWords.length } });
  }, [currentUserId, modeWords.length, settings.dictionarySource, settings.difficulty, settings.wordLength]);
  const canRenderWhileBootstrapping = bootstrapStatus === 'loading' && !blockGuestShellOnBootstrap && (route === 'landing' || Boolean(userProfile.accountMode) || userProfile.role === 'admin');
  if (bootstrapStatus === 'error') return <AuthBootstrapGate error={bootstrapError} onRetry={() => window.location.reload()} />;
  if (bootstrapStatus !== 'ready' && !canRenderWhileBootstrapping) return <AuthBootstrapGate mode="blocking" />;
  const shell = <AppShell route={route} userProfile={userProfile} isAuthenticated={isAuthenticated} showLoginModal={showLoginModal} showRulesModal={showRulesModal} authMode={authMode} tempUsername={tempUsername} tempPassword={tempPassword} authError={authError} isAuthLoading={isAuthLoading} onHomeClick={goRoot} onLoginClick={openLogin} onLogoutClick={handleLogout} onProfileClick={() => setRoute('profile')} onShopClick={() => setRoute('shop')} onAdminClick={() => setRoute('admin')} onAdultRoomClick={() => setRoute('adult_room')} onDictionaryStudioClick={openDictionaryArea} onCloseLogin={() => setShowLoginModal(false)} onCloseRules={() => setShowRulesModal(false)} onAuthModeChange={handleAuthModeChange} onUsernameChange={updateEmail} onPasswordChange={updatePassword} onAuthSubmit={submitEmailAuth} onYandexLogin={loginWithYandex}><AppScreens route={route} entryPath={entryPath} selectedPlayMode={selectedPlayMode} userProfile={userProfile} isAuthenticated={isAuthenticated} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={() => setDailyQuestReward(null)} settings={settings} modeWords={modeWords} activeDictionaryWordCount={activeDictionaryWordCount} classicGame={classicGame} dictionaryUpload={{ isUploadingDictionary: dictionaryUpload.isUploadingDictionary, error: dictionaryUpload.dictionaryUploadError, onFileUpload: dictionaryUpload.handleDictionaryFileUpload }} onRouteChange={setRoute} onEntryPathChange={setEntryPath} onSelectedPlayModeChange={setSelectedPlayMode} onSettingsChange={setSettings} onOpenLogin={openLogin} onOpenRegister={openRegister} onOpenRules={() => setShowRulesModal(true)} onBuy={handleBuy} onUseItem={handleUseItem} onUpdatePet={profileEconomy.updateCharacter} onSaveDictionary={handleSaveDictionary} onSelectAccountMode={handleSelectAccountMode} onCreateChild={handleCreateChild} onChildSetupComplete={handleChildSetupComplete} onGameReward={handleGameReward} onWordPractice={handleWordPractice} onCharacterOnboardingComplete={handleCharacterOnboardingComplete} onGameStarted={startTrackedGame} onTestUnlockPremium={handleTestUnlockPremium} onDictionaryPeek={chargeDictionaryPeek} /></AppShell>;
  return <>{shell}{bootstrapStatus === 'loading' && <AuthBootstrapGate mode="inline" />}</>;
};
export default AppV2;
