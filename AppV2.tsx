import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { AppRouter } from './components/AppRouter';
import { AppHeader } from './components/layout/AppHeader';
import { AppModals } from './components/AppModals';
import { LandingScreen } from './components/screens/LandingScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { ClassicGameScreen } from './components/screens/ClassicGameScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from './components/screens/ModeScreens';
import { Shop } from './components/Shop';
import { PetRoom } from './components/PetRoom';
import { PetWidget } from './components/PetWidget';
import { MAX_GUESSES } from './constants';
import { COMMON_WORDS_EN } from './dictionaries/english';
import { getBestEliminationHint } from './services/hintService';
import { authService } from './services/authService';
import { GUEST_PROFILE } from './providers/ProfileProvider';
import { useDictionaryPools } from './hooks/useDictionaryPools';
import { useProfileEconomy } from './hooks/useProfileEconomy';
import { CharStatus, EnrichedWord, GameSettings, GameState, ShopItem, UserProfile, UserStats, ViewState } from './types';

const createInitialGameState = (): GameState => ({
  secretWord: '',
  secretWordData: null,
  guesses: [],
  history: [],
  currentGuess: '',
  gameStatus: 'playing',
  rowIndex: 0,
  hint: null,
  loadingHint: false,
  error: null,
});

const getInitialSettings = (): GameSettings => ({
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Guest',
});

const getGuessLetterStatuses = (guess: string, secretWord: string): CharStatus[] => {
  const statuses: CharStatus[] = Array(guess.length).fill('absent');
  const secretArr = secretWord.split('');
  const guessArr = guess.split('');

  guessArr.forEach((char, index) => {
    if (char === secretArr[index]) {
      statuses[index] = 'correct';
      secretArr[index] = '#';
    }
  });

  guessArr.forEach((char, index) => {
    if (statuses[index] === 'correct') return;
    const matchIndex = secretArr.indexOf(char);
    if (matchIndex >= 0) {
      statuses[index] = 'present';
      secretArr[matchIndex] = '#';
    }
  });

  return statuses;
};

const getUpdatedKeyStatuses = (
  previous: Record<string, CharStatus>,
  guess: string,
  secretWord: string,
): Record<string, CharStatus> => {
  const next = { ...previous };
  const rowStatuses = getGuessLetterStatuses(guess, secretWord);

  guess.split('').forEach((char, index) => {
    const status = rowStatuses[index];
    const current = next[char];
    if (status === 'correct') next[char] = 'correct';
    else if (status === 'present' && current !== 'correct') next[char] = 'present';
    else if (!current) next[char] = 'absent';
  });

  return next;
};

const AppV2: React.FC = () => {
  const [route, setRoute] = useState<ViewState>('landing');
  const [settings, setSettings] = useState<GameSettings>(getInitialSettings);
  const [userProfile, setUserProfile] = useState<UserProfile>(GUEST_PROFILE);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isUploadingDict, setIsUploadingDict] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, CharStatus>>({});
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);

  const { getSecretWordPool, getValidationPool, getModeWords } = useDictionaryPools({ settings, userProfile });
  const profileEconomy = useProfileEconomy({
    currentUserId: currentUser?.id ?? null,
    userProfile,
    setUserProfile,
  });

  const isAuthenticated = Boolean(currentUser);

  const loadProfileForUser = useCallback(async (user: User) => {
    const { userService } = await import('./services/userService');
    const profile = await userService.getOrCreateProfile(
      user.id,
      user.user_metadata?.full_name || user.user_metadata?.name || 'Guest',
      user.email || undefined,
    );
    setUserProfile(profile);
    setSettings(prev => ({ ...prev, username: profile.username }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    authService.getInitialSession()
      .then(async ({ user }) => {
        if (cancelled) return;
        setCurrentUser(user);
        if (user) await loadProfileForUser(user);
      })
      .catch(error => console.error('Initial auth bootstrap failed', error));

    const unsubscribe = authService.onAuthStateChange(async (_session, user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        await loadProfileForUser(user);
        setShowLoginModal(false);
      } else {
        setUserProfile(GUEST_PROFILE);
        setSettings(getInitialSettings());
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadProfileForUser]);

  useEffect(() => {
    setSetupError(null);
  }, [settings]);

  const goHome = useCallback(() => setRoute('landing'), []);

  const openLogin = useCallback(() => {
    setAuthMode('login');
    setAuthError(null);
    setShowLoginModal(true);
  }, []);

  const handleAuthSubmit = useCallback(async () => {
    if (!tempUsername.trim() || !tempPassword.trim()) {
      setAuthError('Заполните все поля');
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'login') {
        await authService.signInWithEmail(tempUsername, tempPassword);
      } else {
        const result = await authService.signUpWithEmail(tempUsername, tempPassword);
        if (result.needsEmailConfirmation) {
          setAuthError('На ваш email отправлено письмо для подтверждения. Пожалуйста, подтвердите его перед входом.');
        }
      }
      setTempUsername('');
      setTempPassword('');
    } catch (error: any) {
      setAuthError(error?.message || 'Ошибка авторизации');
    } finally {
      setIsAuthLoading(false);
    }
  }, [authMode, tempPassword, tempUsername]);

  const handleYandexLogin = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await authService.signInWithYandex();
    } catch (error: any) {
      setAuthError(error?.message || 'Ошибка входа через Яндекс');
      setIsAuthLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      await authService.signOut();
    } finally {
      setIsAuthLoading(false);
      setCurrentUser(null);
      setUserProfile(GUEST_PROFILE);
      setSettings(getInitialSettings());
      setRoute('landing');
    }
  }, []);

  const startNewGame = useCallback(() => {
    setSetupError(null);
    const filteredPool = getSecretWordPool().filter(entry => entry.word.length === settings.wordLength);

    if (filteredPool.length === 0) {
      setSetupError(
        settings.dictionarySource === 'custom'
          ? `В вашем словаре нет слов длиной ${settings.wordLength}.`
          : `В словаре нет слов уровня ${settings.difficulty} длиной ${settings.wordLength}.`,
      );
      return;
    }

    const randomEntry: EnrichedWord = filteredPool[Math.floor(Math.random() * filteredPool.length)];
    setGameState({
      ...createInitialGameState(),
      secretWord: randomEntry.word,
      secretWordData: randomEntry,
    });
    setKeyStatuses({});
    setRoute('game');
  }, [getSecretWordPool, settings.dictionarySource, settings.difficulty, settings.wordLength]);

  const handleChar = useCallback((char: string) => {
    setGameState(prev => {
      if (prev.gameStatus !== 'playing' || prev.currentGuess.length >= settings.wordLength) return prev;
      return { ...prev, currentGuess: prev.currentGuess + char, error: null };
    });
  }, [settings.wordLength]);

  const handleDelete = useCallback(() => {
    setGameState(prev => {
      if (prev.gameStatus !== 'playing') return prev;
      return { ...prev, currentGuess: prev.currentGuess.slice(0, -1), error: null };
    });
  }, []);

  const triggerShake = useCallback(() => {
    setShakeRowIndex(gameState.rowIndex);
    window.setTimeout(() => setShakeRowIndex(null), 600);
  }, [gameState.rowIndex]);

  const updateStats = useCallback(async (won: boolean, word: string) => {
    const nextStats: UserStats = { ...userProfile.stats, wordsGuessed: { ...userProfile.stats.wordsGuessed } };
    nextStats.gamesPlayed += 1;

    if (won) {
      nextStats.gamesWon += 1;
      nextStats.wordsGuessed[word] = (nextStats.wordsGuessed[word] || 0) + 1;
      await profileEconomy.addXP(50);
      await profileEconomy.winCoins(20);
    }

    await profileEconomy.updateStats(nextStats);
  }, [profileEconomy, userProfile.stats]);

  const handleEnter = useCallback(async () => {
    if (gameState.gameStatus !== 'playing') return;

    if (gameState.currentGuess.length !== settings.wordLength) {
      setGameState(prev => ({ ...prev, error: 'Недостаточно букв' }));
      triggerShake();
      return;
    }

    const validWords = getValidationPool();
    if (!validWords.includes(gameState.currentGuess)) {
      setGameState(prev => ({ ...prev, error: 'Такого слова нет в словаре' }));
      triggerShake();
      return;
    }

    const guessedWord = gameState.currentGuess;
    const wordEntry = COMMON_WORDS_EN.find(entry => entry.word.toUpperCase() === guessedWord);
    const newGuesses = [...gameState.guesses, guessedWord];
    let nextStatus: GameState['gameStatus'] = 'playing';

    if (guessedWord === gameState.secretWord) nextStatus = 'won';
    else if (newGuesses.length >= MAX_GUESSES) nextStatus = 'lost';

    setKeyStatuses(prev => getUpdatedKeyStatuses(prev, guessedWord, gameState.secretWord));
    setGameState(prev => ({
      ...prev,
      guesses: newGuesses,
      history: [...prev.history, { word: guessedWord, translation: wordEntry?.translation || null }],
      currentGuess: '',
      gameStatus: nextStatus,
      rowIndex: prev.rowIndex + 1,
      hint: null,
      error: null,
    }));

    if (nextStatus !== 'playing') await updateStats(nextStatus === 'won', gameState.secretWord);
  }, [gameState, getValidationPool, settings.wordLength, triggerShake, updateStats]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (route !== 'game') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Enter') handleEnter();
      else if (event.key === 'Backspace') handleDelete();
      else {
        const char = event.key.toUpperCase();
        if (/^[A-Z]$/.test(char)) handleChar(char);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleChar, handleDelete, handleEnter, route]);

  const fetchHint = useCallback(async () => {
    if (gameState.gameStatus !== 'playing') return;
    const hintPool = getModeWords().filter(word => word.length === settings.wordLength);

    setGameState(prev => ({ ...prev, loadingHint: true }));
    window.setTimeout(() => {
      const bestWord = getBestEliminationHint(gameState.secretWord, gameState.guesses, hintPool);
      setGameState(prev => ({
        ...prev,
        hint: bestWord ? `Попробуйте слово: ${bestWord}` : 'Нет подходящих слов для подсказки.',
        loadingHint: false,
      }));
    }, 500);
  }, [gameState.gameStatus, gameState.guesses, gameState.secretWord, getModeWords, settings.wordLength]);

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
  }, [profileEconomy]);

  const modeWords = useMemo(() => getModeWords(), [getModeWords]);

  const handleBuy = useCallback(async (item: ShopItem) => profileEconomy.buyItem(item), [profileEconomy]);
  const handleUseItem = useCallback(async (itemId: string) => profileEconomy.useItem(itemId), [profileEconomy]);

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
        setupError={setupError}
        isUploadingDictionary={isUploadingDict}
        onSettingsChange={setSettings}
        onFileUpload={handleFileUpload}
        onStartGame={startNewGame}
        onBack={goHome}
      />
    ),
    game: (
      <ClassicGameScreen
        gameState={gameState}
        settings={settings}
        keyStatuses={keyStatuses}
        shakeRowIndex={shakeRowIndex}
        onChar={handleChar}
        onDelete={handleDelete}
        onEnter={handleEnter}
        onHint={fetchHint}
        onRestart={startNewGame}
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
        onAuthSubmit={handleAuthSubmit}
        onYandexLogin={handleYandexLogin}
      />
    </div>
  );
};

export default AppV2;
