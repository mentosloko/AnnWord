import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameSettings, GameState, CharStatus, UserProfile, WordLength, EnrichedWord, ViewState, DictionarySource, DifficultyLevel, PetState, UserStats } from './types';
import { MAX_GUESSES } from './constants';
import { COMMON_WORDS_EN, ALL_WORDS_EN } from './dictionaries/english';
import { Grid } from './components/Grid';
import { Keyboard } from './components/Keyboard';
import { getBestEliminationHint } from './services/hintService';
import { userService } from './services/userService';
import { findClosestWord } from './utils/textUtils';
import { PetWidget } from './components/PetWidget';

import { AnagramGame } from './components/AnagramGame';
import { SprintGame } from './components/SprintGame';
import { MemoryGame } from './components/MemoryGame';
import { HangmanGame } from './components/HangmanGame';
import { Shop } from './components/Shop';
import { PetRoom } from './components/PetRoom';
import { ShopItem } from './types';

import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';

// --- Icons ---
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);
const LoaderIcon = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
);
const LoginIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
);
const TranslateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>
);
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);
const ListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// Default guest profile — used on logout and initial state
const GUEST_PROFILE: UserProfile = {
  username: 'Guest',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Owl',
    type: 'Owl',
    level: 1,
    mood: 'neutral',
    xp: 0,
    hunger: 100,
    energy: 100,
    equippedAccessories: []
  },
  coins: 100,
  inventory: []
};

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<ViewState>('landing');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [settings, setSettings] = useState<GameSettings>({
    wordLength: 5,
    useCustomDictionary: false,
    dictionarySource: 'builtin',
    difficulty: 'ALL',
    username: 'Guest',
  });

  // Profile Data
  const [userProfile, setUserProfile] = useState<UserProfile>(GUEST_PROFILE);

  // Safety timeout for auth loading
  useEffect(() => {
    let timeout: any;
    if (isAuthLoading) {
      timeout = setTimeout(() => {
        console.warn("Auth loading timed out after 8s. Forcing entry as guest.");
        setIsAuthLoading(false);
        setShowLoginModal(false);
        if (!userProfile || userProfile.username === 'Guest') {
          setUserProfile(GUEST_PROFILE);
        }
      }, 8000);
    }
    return () => clearTimeout(timeout);
  }, [isAuthLoading, userProfile]);

  // Loading States
  const [isUploadingDict, setIsUploadingDict] = useState(false);
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);

  const [gameState, setGameState] = useState<GameState>({
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

  const [keyStatuses, setKeyStatuses] = useState<Record<string, CharStatus>>({});
  
  const historyScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
    }
  }, [gameState.history]);

  useEffect(() => {
    setSetupError(null);
  }, [settings]);

  // --- Auth & Profile Management ---

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      console.log("Auth event:", event, "User:", user?.id);
      
      setCurrentUser(user as any);
      setIsAuthReady(true);
      
      if (user) {
        try {
          console.log("Fetching profile for user:", user.id);
          const profile = await userService.getOrCreateProfile(
            user.id, 
            user.user_metadata?.full_name || user.user_metadata?.name || 'Guest', 
            user.email
          );
          console.log("Profile loaded:", profile.username);
          setUserProfile(profile);
          setSettings(prev => ({ ...prev, username: profile.username }));
          setShowLoginModal(false);
          setIsAuthLoading(false);
        } catch (e) {
          console.error("Error fetching profile on auth change", e);
          setIsAuthLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || "Ошибка входа через Google");
      setIsAuthLoading(false);
    }
  };

  // Yandex OAuth: in production routes through Express (/api/auth/yandex).
  // On localhost (Vite dev server) that route doesn't exist, so we fall back
  // to a Supabase OAuth redirect via the SDK — same UX for the developer.
  const handleYandexLogin = async () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      // Dev fallback: use Supabase OAuth directly
      setIsAuthLoading(true);
      setAuthError(null);
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'yandex' as any,
          options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
      } catch (err: any) {
        setAuthError('Яндекс OAuth недоступен в dev-режиме. Используй Google или email.');
        setIsAuthLoading(false);
      }
    } else {
      window.location.href = '/api/auth/yandex';
    }
  };

  const handleAuthSubmit = async () => {
    if (!tempUsername.trim() || !tempPassword.trim()) {
      setAuthError("Заполните все поля");
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    console.log("Submitting auth:", authMode, "Email:", tempUsername);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: tempUsername,
          password: tempPassword,
        });
        if (error) throw error;
        console.log("Login request successful, waiting for onAuthStateChange...");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: tempUsername,
          password: tempPassword,
          options: {
            data: {
              name: tempUsername.split('@')[0]
            }
          }
        });
        if (error) throw error;
        
        console.log("Sign up request successful. Session:", !!data.session);
        
        if (data.user && !data.session) {
          setAuthError("На ваш email отправлено письмо для подтверждения. Пожалуйста, подтвердите его перед входом.");
          setIsAuthLoading(false);
          return;
        }
      }
      
      setTempUsername('');
      setTempPassword('');
    } catch (err: any) {
      console.error("Auth submit error:", err);
      setAuthError(err.message || "Ошибка авторизации. Попробуйте войти через Google.");
      setIsAuthLoading(false);
    }
  };

  const handleWinCoins = async (amount: number) => {
    if (!currentUser) return;
    await userService.updateCoins(currentUser.id, amount);
    setUserProfile(prev => ({ ...prev, coins: prev.coins + amount }));
  };

  const handleBuyItem = async (item: ShopItem) => {
    if (!currentUser) return;
    try {
      const updatedProfile = await userService.buyItem(currentUser.id, item);
      setUserProfile(updatedProfile);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUseItem = async (itemId: string) => {
    if (!currentUser) return;
    try {
      const updatedProfile = await userService.useItem(currentUser.id, itemId);
      setUserProfile(updatedProfile);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Reset settings
      setSettings(prev => ({ 
        ...prev, 
        username: 'Guest',
        dictionarySource: 'builtin',
        useCustomDictionary: false
      }));
      // Reset profile with a COMPLETE PetState to avoid runtime crashes
      setUserProfile(GUEST_PROFILE);
      setCurrentUser(null);
      setView('landing');
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const addXP = async (amount: number) => {
    if (!currentUser) return;
    const newPet: PetState = { ...userProfile.pet, xp: userProfile.pet.xp + amount };
    if (newPet.xp >= newPet.level * 100) {
      newPet.xp -= newPet.level * 100;
      newPet.level += 1;
      newPet.mood = 'excited';
    } else {
      newPet.mood = 'happy';
    }
    setUserProfile(prev => ({ ...prev, pet: newPet }));
    try {
      await userService.updateUserPet(currentUser.id, newPet);
    } catch (e) {
      console.error("Failed to update pet", e);
    }
  };


  // --- Game Helpers ---

  const getSecretWordPool = useCallback(() => {
     let pool: EnrichedWord[] = [];
     if (settings.dictionarySource === 'custom' && userProfile.customDictionaryEn.length > 0) {
        pool = userProfile.customDictionaryEn.map(w => ({ word: w.toUpperCase(), translation: '', level: 'Custom' }));
     } else {
        pool = COMMON_WORDS_EN;
        if (settings.difficulty !== 'ALL') {
          pool = pool.filter(w => w.level === settings.difficulty);
        }
        pool = pool.map(w => ({ ...w, word: w.word.toUpperCase() }));
     }
     return pool.filter(w => !w.word.endsWith('S') || w.word.endsWith('SS'));
  }, [settings.dictionarySource, settings.difficulty, userProfile.customDictionaryEn]);

  const getValidationPool = useCallback(() => {
    const basePool = ALL_WORDS_EN;
    let combinedPool = basePool.filter(w => w.length === settings.wordLength).map(w => w.toUpperCase());
    if (userProfile.customDictionaryEn.length > 0) {
       const customFiltered = userProfile.customDictionaryEn
         .filter(w => w.length === settings.wordLength)
         .map(w => w.toUpperCase());
       combinedPool = [...combinedPool, ...customFiltered];
    }
    return Array.from(new Set(combinedPool));
  }, [settings.wordLength, userProfile.customDictionaryEn]);


  const startNewGame = useCallback(() => {
    setSetupError(null);
    const rawPool = getSecretWordPool();
    const filteredPool = rawPool.filter(w => w.word.length === settings.wordLength);
    
    if (filteredPool.length === 0) {
      let msg = "Слов с такими настройками не найдено.";
      if (settings.dictionarySource === 'custom') {
        msg = `В вашем словаре нет слов длиной ${settings.wordLength}.`;
      } else {
        msg = `В словаре нет слов уровня ${settings.difficulty} длиной ${settings.wordLength}.`;
      }
      setSetupError(msg);
      return;
    }
    
    let secretWord = '';
    let secretWordData: EnrichedWord | null = null;

    if (filteredPool.length > 0) {
      const randomEntry = filteredPool[Math.floor(Math.random() * filteredPool.length)];
      secretWord = randomEntry.word;
      secretWordData = randomEntry;
    }
    
    setGameState({
      secretWord: secretWord,
      secretWordData: secretWordData,
      guesses: [],
      history: [],
      currentGuess: '',
      gameStatus: 'playing',
      rowIndex: 0,
      hint: null,
      loadingHint: false,
      error: null,
    });
    setKeyStatuses({});
    setView('game');
  }, [getSecretWordPool, settings.wordLength, settings.dictionarySource, settings.difficulty]);


  // --- Logic ---

  const handleChar = (char: string) => {
    if (gameState.gameStatus !== 'playing') return;
    if (gameState.currentGuess.length < settings.wordLength) {
      setGameState(prev => ({ ...prev, currentGuess: prev.currentGuess + char, error: null }));
    }
  };

  const handleDelete = () => {
    if (gameState.gameStatus !== 'playing') return;
    setGameState(prev => ({ ...prev, currentGuess: prev.currentGuess.slice(0, -1), error: null }));
  };

  const updateStats = async (won: boolean, word: string) => {
    if (!currentUser) return;

    const newStats: UserStats = { ...userProfile.stats };
    newStats.gamesPlayed += 1;
    if (won) {
      newStats.gamesWon += 1;
      newStats.wordsGuessed[word] = (newStats.wordsGuessed[word] || 0) + 1;
      addXP(50);
      handleWinCoins(20);
    }
    
    setUserProfile(prev => ({ ...prev, stats: newStats }));

    try {
      await userService.updateUserStats(currentUser.id, newStats);
    } catch (e) {
      console.error("Failed to sync stats to server", e);
    }
  };

  const triggerShake = () => {
    setShakeRowIndex(gameState.rowIndex);
    setTimeout(() => setShakeRowIndex(null), 600);
  };

  const handleEnter = async () => {
    if (gameState.gameStatus !== 'playing') return;
    
    if (gameState.currentGuess.length !== settings.wordLength) {
       setGameState(prev => ({ ...prev, error: "Недостаточно букв" }));
       triggerShake();
       return;
    }

    const validWords = getValidationPool();
    if (!validWords.includes(gameState.currentGuess)) {
      let typoSearchPool = validWords;
      if (settings.dictionarySource === 'custom') {
         typoSearchPool = userProfile.customDictionaryEn;
      }
      const relevantPool = typoSearchPool.filter(w => w.length === settings.wordLength);
      setGameState(prev => ({ ...prev, error: "Такого слова нет в словаре" }));
      triggerShake();
      return;
    }

    const wordEntry = COMMON_WORDS_EN.find(w => w.word === gameState.currentGuess);
    const translation = wordEntry ? wordEntry.translation : null;
    const newHistoryItem = { word: gameState.currentGuess, translation };
    const newHistory = [...gameState.history, newHistoryItem];

    const newGuesses = [...gameState.guesses, gameState.currentGuess];
    
    const newKeyStatuses = { ...keyStatuses };
    const secretArr = gameState.secretWord.split('');
    const guessArr = gameState.currentGuess.split('');

    guessArr.forEach((char, i) => {
      const currentStatus = newKeyStatuses[char];
      if (char === secretArr[i]) {
        newKeyStatuses[char] = 'correct';
      } else if (gameState.secretWord.includes(char)) {
        if (currentStatus !== 'correct') {
          newKeyStatuses[char] = 'present';
        }
      } else {
        if (currentStatus !== 'correct' && currentStatus !== 'present') {
          newKeyStatuses[char] = 'absent';
        }
      }
    });
    setKeyStatuses(newKeyStatuses);

    let newStatus: GameState['gameStatus'] = 'playing';
    if (gameState.currentGuess === gameState.secretWord) {
      newStatus = 'won';
      updateStats(true, gameState.secretWord);
    } else if (newGuesses.length >= MAX_GUESSES) {
      newStatus = 'lost';
      updateStats(false, gameState.secretWord);
    }

    setGameState(prev => ({
      ...prev,
      guesses: newGuesses,
      history: newHistory,
      currentGuess: '',
      gameStatus: newStatus,
      rowIndex: prev.rowIndex + 1,
      hint: null,
      error: null
    }));
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (view !== 'game') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
      handleEnter();
    } else if (e.key === 'Backspace') {
      handleDelete();
    } else {
      const char = e.key.toUpperCase();
      const isEnChar = /^[A-Z]$/.test(char);
      if (isEnChar) handleChar(char);
    }
  }, [gameState, settings, view, keyStatuses, userProfile]); 

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  // --- Feature Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDict(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rawWords = text.split(/[\n\s,]+/);
      const cleanedWords = rawWords
        .map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
        .filter(w => w.length > 0);
      
      setUserProfile(prev => ({
        ...prev,
        customDictionaryEn: cleanedWords
      }));
      
      try {
        if (currentUser) {
          await userService.updateUserDictionary(currentUser.id, cleanedWords);
        }
      } catch (e) {
        console.error("Failed to upload dictionary", e);
      } finally {
        setIsUploadingDict(false);
      }
    };
    reader.readAsText(file);
  };

  const fetchHint = async () => {
    if (gameState.gameStatus !== 'playing') return;
    
    let hintPool: string[] = [];
    if (settings.dictionarySource === 'custom' && userProfile.customDictionaryEn.length > 0) {
      hintPool = userProfile.customDictionaryEn;
    } else {
      hintPool = COMMON_WORDS_EN.map(w => w.word);
    }
    hintPool = hintPool.filter(w => w.length === settings.wordLength);

    setGameState(prev => ({ ...prev, loadingHint: true }));
    
    setTimeout(() => {
      const bestWord = getBestEliminationHint(
        gameState.secretWord, 
        gameState.guesses, 
        hintPool
      );

      const hintText = bestWord 
        ? `Попробуйте слово: ${bestWord}` 
        : "Нет подходящих слов для подсказки.";

      setGameState(prev => ({ 
        ...prev, 
        hint: hintText, 
        loadingHint: false 
      }));
    }, 500);
  };

  // --- Views ---

  const renderAuthModal = () => {
    if (!showLoginModal) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {authMode === 'login' ? 'Вход' : 'Регистрация'}
              </h3>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
                 ⚠️ {authError}
              </div>
            )}

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleAuthSubmit();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Электронная почта</label>
                <input 
                  autoFocus
                  type="email" 
                  autoComplete="email"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Пароль</label>
                <input 
                  type="password" 
                  autoComplete={authMode === 'login' ? "current-password" : "new-password"}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              <button 
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 active:scale-[0.98] transition flex justify-center items-center"
              >
                {isAuthLoading ? <LoaderIcon /> : (authMode === 'login' ? 'Войти' : 'Создать аккаунт')}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400 font-bold">Или</span>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 active:scale-[0.98] transition flex justify-center items-center gap-2"
                >
                  <GoogleIcon />
                  Войти через Google
                </button>

                <button 
                  type="button"
                  onClick={handleYandexLogin}
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 active:scale-[0.98] transition flex justify-center items-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20Z" fill="#FF0000"/>
                    <path d="M12.75 14.75H10.75V8.75L8.75 14.75H6.75L9.25 7.25V5.25H12.75V14.75Z" fill="white"/>
                  </svg>
                  Войти через Яндекс
                </button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm">
              <span className="text-gray-500">
                {authMode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
              </span>
              <button 
                onClick={() => {
                   setAuthMode(authMode === 'login' ? 'register' : 'login');
                   setAuthError(null);
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                {authMode === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </div>
          </div>
        </div>
    );
  };

  const renderRulesModal = () => {
    if (!showRulesModal) return null;
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowRulesModal(false);
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                 <div className="text-indigo-500 bg-indigo-50 p-2 rounded-full">
                    <InfoIcon />
                 </div>
                 <h3 className="text-xl font-bold text-gray-800">Правила игры</h3>
              </div>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-600 mb-6 leading-relaxed">
              Ваша задача — угадать загаданное слово за <strong>6 попыток</strong>. 
              Каждая догадка должна быть существующим словом. После ввода слова цвета плиток изменятся:
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500 text-white font-bold flex items-center justify-center rounded text-xl border-2 border-green-600 flex-shrink-0">W</div>
                <div>
                  <span className="font-bold text-gray-800">Зеленый</span>
                  <p className="text-sm text-gray-500">Буква угадана верно и стоит на своем месте.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-500 text-white font-bold flex items-center justify-center rounded text-xl border-2 border-yellow-600 flex-shrink-0">O</div>
                <div>
                  <span className="font-bold text-gray-800">Желтый</span>
                  <p className="text-sm text-gray-500">Буква есть в слове, но стоит в другом месте.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-500 text-white font-bold flex items-center justify-center rounded text-xl border-2 border-gray-600 flex-shrink-0">R</div>
                <div>
                  <span className="font-bold text-gray-800">Серый</span>
                  <p className="text-sm text-gray-500">Этой буквы нет в загаданном слове.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-8 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition"
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <header className="w-full max-w-2xl flex items-center justify-between mb-8">
        <div className="flex items-center">
          <button onClick={() => setView('landing')} className="p-2 hover:bg-gray-200 rounded-full transition">
            <BackIcon />
          </button>
          <h2 className="text-2xl font-bold ml-4">Профиль игрока</h2>
        </div>
        
        {settings.username !== 'Guest' && (
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition text-sm font-bold"
          >
            <LogoutIcon /> Выйти
          </button>
        )}
      </header>

      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
            <UserIcon />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{userProfile.username}</h3>
            {settings.username === 'Guest' ? (
              <p className="text-amber-500 text-sm font-medium">Войдите, чтобы сохранять прогресс</p>
            ) : (
               <div className="flex items-center gap-3">
                 <p className="text-gray-500">Уровень питомца: <span className="font-bold text-indigo-600">{userProfile.pet.level}</span></p>
               </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-xl text-center">
            <div className="text-3xl font-black text-gray-900">{userProfile.stats.gamesPlayed}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide">Всего игр</div>
          </div>
          <div className="bg-green-50 p-4 rounded-xl text-center">
            <div className="text-3xl font-black text-green-600">{userProfile.stats.gamesWon}</div>
            <div className="text-sm text-green-600 uppercase tracking-wide">Побед</div>
          </div>
        </div>

        <h4 className="font-bold text-gray-800 mb-4">Лучшие слова</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(userProfile.stats.wordsGuessed)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 10)
            .map(([word, count]) => (
              <span key={word} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                {word} <span className="text-indigo-400 text-xs ml-1">x{count}</span>
              </span>
            ))}
          {Object.keys(userProfile.stats.wordsGuessed).length === 0 && (
            <p className="text-gray-400 italic">Пока нет угаданных слов</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col h-[90vh]">
        <div className="bg-indigo-600 p-4 rounded-t-2xl text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-full">
               <ListIcon />
             </div>
             <div>
               <h2 className="text-lg font-bold">История слов</h2>
               <p className="text-xs text-indigo-200">Слова из текущей игры</p>
             </div>
          </div>
          <button onClick={() => setView('landing')} className="p-2 hover:bg-white/20 rounded-full transition">
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {gameState.history.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p>Нет введенных слов</p>
            </div>
          ) : (
            gameState.history.map((item, idx) => {
               const isCorrect = item.word === gameState.secretWord;
               return (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border-l-4 shadow-sm ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'}`}>
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{item.word}</p>
                      {item.translation && (
                        <p className="text-sm text-indigo-600 font-medium">{item.translation}</p>
                      )}
                    </div>
                    {isCorrect && (
                      <span className="text-green-600 text-sm font-bold bg-green-100 px-2 py-1 rounded">Верно!</span>
                    )}
                  </div>
               );
            })
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-2xl shrink-0 flex gap-3">
          <button 
            onClick={() => setView('landing')}
            className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition shadow-sm"
          >
            Меню
          </button>
          <button 
            onClick={startNewGame}
            className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition shadow-md flex justify-center items-center gap-2"
          >
            <RefreshIcon /> Играть снова
          </button>
        </div>
      </div>
    </div>
  );

  const renderLanding = () => (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-sky-200 via-purple-100 to-pink-100 p-4 relative overflow-y-auto pb-20">
      
      <div className="w-full flex justify-between px-2 sm:px-8 pt-4 mb-2 gap-2">
         <div className="flex gap-2">
           <button 
              onClick={() => setShowRulesModal(true)}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold bg-white/80 backdrop-blur p-3 rounded-2xl shadow-sm hover:shadow-md transition"
              title="Правила игры"
            >
              <InfoIcon /> 
              <span className="hidden sm:inline">Правила</span>
            </button>

            {userProfile.role === 'admin' && (
              <button 
                onClick={() => setView('admin')}
                className="flex items-center gap-2 text-red-600 hover:text-red-800 font-bold bg-white/80 backdrop-blur px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition border-2 border-red-100"
              >
                🛡️ Админ
              </button>
            )}
         </div>

         {settings.username === 'Guest' ? (
          <button 
            onClick={() => {
              setAuthMode('login');
              setAuthError(null);
              setTempUsername('');
              setTempPassword('');
              setShowLoginModal(true);
            }}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold bg-white/80 backdrop-blur px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition"
          >
            <LoginIcon /> Войти
          </button>
        ) : (
          <button 
            onClick={() => setView('profile')}
            className="flex items-center gap-2 text-indigo-900 hover:text-indigo-700 font-bold bg-white/80 backdrop-blur px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition"
          >
            <UserIcon /> Привет, {settings.username}
          </button>
        )}
      </div>

      {settings.username !== 'Guest' && (
        <div className="w-full max-w-2xl flex justify-end gap-4 px-2 sm:px-8 mb-4">
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full text-sm font-bold text-yellow-700">
            🪙 {userProfile.coins}
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full text-sm font-bold text-indigo-700">
            ⭐ Ур. {userProfile.pet?.level || 1}
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h1 className="text-5xl font-black text-indigo-900 tracking-tight drop-shadow-sm">AnnWord</h1>
        <p className="text-indigo-600 mt-1 text-base font-medium">Угадай слово · Учи английский</p>
      </div>

      {settings.username !== 'Guest' && (
        <PetWidget pet={userProfile.pet} onNavigateToPetRoom={() => setView('petroom')} />
      )}

      <div className="w-full max-w-sm space-y-3 mt-4">
        {setupError && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center">
            ⚠️ {setupError}
          </div>
        )}
        
        <button 
          onClick={startNewGame}
          className="w-full py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all"
        >
          🎮 Играть (Wordle)
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setView('anagram')}
            className="py-3 bg-white text-indigo-700 font-bold rounded-2xl shadow-md hover:bg-indigo-50 active:scale-[0.98] transition-all border border-indigo-100"
          >
            🔤 Анаграммы
          </button>
          <button 
            onClick={() => setView('sprint')}
            className="py-3 bg-white text-green-700 font-bold rounded-2xl shadow-md hover:bg-green-50 active:scale-[0.98] transition-all border border-green-100"
          >
            ⚡ Спринт
          </button>
          <button 
            onClick={() => setView('memory')}
            className="py-3 bg-white text-purple-700 font-bold rounded-2xl shadow-md hover:bg-purple-50 active:scale-[0.98] transition-all border border-purple-100"
          >
            🧠 Память
          </button>
          <button 
            onClick={() => setView('hangman')}
            className="py-3 bg-white text-red-700 font-bold rounded-2xl shadow-md hover:bg-red-50 active:scale-[0.98] transition-all border border-red-100"
          >
            🪢 Виселица
          </button>
        </div>

        <button 
          onClick={() => setView('shop')}
          className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold rounded-2xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
        >
          🛒 Магазин · {userProfile.coins} 🪙
        </button>
      </div>

      <div className="w-full max-w-sm mt-6 bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-indigo-100">
        <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Настройки</h3>
        
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 mb-2">Длина слова</label>
          <div className="flex gap-2">
            {([3,4,5,6,7] as WordLength[]).map(len => (
              <button 
                key={len}
                onClick={() => setSettings(prev => ({ ...prev, wordLength: len }))}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${
                  settings.wordLength === len 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {len}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 mb-2">Сложность</label>
          <div className="flex gap-2">
            {(['ALL', 'A1', 'A2', 'B1', 'B2'] as DifficultyLevel[]).map(level => (
              <button 
                key={level}
                onClick={() => setSettings(prev => ({ ...prev, difficulty: level }))}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition ${
                  settings.difficulty === level 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2">Словарь</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSettings(prev => ({ ...prev, dictionarySource: 'builtin', useCustomDictionary: false }))}
              className={`flex-1 py-2 rounded-xl font-bold text-xs transition ${
                settings.dictionarySource === 'builtin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Встроенный
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  setAuthMode('login');
                  setShowLoginModal(true);
                  return;
                }
                setSettings(prev => ({ ...prev, dictionarySource: 'custom', useCustomDictionary: true }));
              }}
              className={`flex-1 py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1 ${
                settings.dictionarySource === 'custom'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {!currentUser && <LockIcon />}
              Свой
            </button>
          </div>

          {settings.dictionarySource === 'custom' && currentUser && (
            <div className="mt-2">
              <label className="cursor-pointer flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <input 
                  type="file" 
                  accept=".txt,.csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  disabled={isUploadingDict}
                />
                {isUploadingDict ? '⏳ Загрузка...' : '📁 Загрузить словарь (.txt)'}
              </label>
              {userProfile.customDictionaryEn.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{userProfile.customDictionaryEn.length} слов загружено</p>
              )}
            </div>
          )}
        </div>
      </div>

      {gameState.history.length > 0 && (
        <div className="w-full max-w-sm mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">История этой игры</span>
            <button 
              onClick={() => setView('review')}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Все ({gameState.history.length})
            </button>
          </div>
          <div ref={historyScrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {gameState.history.map((item, idx) => (
              <div key={idx} className="flex-shrink-0 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100 min-w-[80px] text-center">
                <p className="font-bold text-gray-800 text-sm">{item.word}</p>
                {item.translation && (
                  <p className="text-xs text-indigo-500">{item.translation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderGame = () => {
    const isGameOver = gameState.gameStatus !== 'playing';
    
    return (
      <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-900 p-4">
        <div className="w-full max-w-lg flex items-center justify-between mb-4">
          <button 
            onClick={() => setView('landing')}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <BackIcon />
          </button>
          <div className="text-center">
            <h2 className="text-white font-black text-xl">AnnWord</h2>
            <p className="text-indigo-300 text-xs">{settings.wordLength} букв · {settings.difficulty}</p>
          </div>
          <button 
            onClick={fetchHint}
            disabled={gameState.loadingHint || isGameOver}
            className="p-2 text-white/60 hover:text-yellow-300 hover:bg-white/10 rounded-full transition disabled:opacity-30"
            title="Подсказка"
          >
            {gameState.loadingHint ? '⏳' : '💡'}
          </button>
        </div>

        {gameState.hint && (
          <div className="w-full max-w-lg mb-3 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-xl text-yellow-200 text-sm text-center font-medium">
            {gameState.hint}
          </div>
        )}

        {gameState.error && (
          <div className="w-full max-w-lg mb-3 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm text-center font-medium">
            {gameState.error}
          </div>
        )}

        <Grid
          guesses={gameState.guesses}
          currentGuess={gameState.currentGuess}
          secretWord={gameState.secretWord}
          maxGuesses={MAX_GUESSES}
          wordLength={settings.wordLength}
          shakeRowIndex={shakeRowIndex}
        />

        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-lg my-4 p-4 rounded-2xl text-center ${
              gameState.gameStatus === 'won' 
                ? 'bg-green-500/20 border border-green-400/30' 
                : 'bg-red-500/20 border border-red-400/30'
            }`}
          >
            <p className="text-2xl font-black text-white mb-1">
              {gameState.gameStatus === 'won' ? '🎉 Победа!' : '😞 Проигрыш'}
            </p>
            <p className="text-white/70 text-sm mb-1">
              Слово: <span className="text-white font-bold">{gameState.secretWord}</span>
            </p>
            {gameState.secretWordData?.translation && (
              <p className="text-indigo-300 text-xs flex items-center justify-center gap-1">
                <TranslateIcon /> {gameState.secretWordData.translation}
              </p>
            )}
            <div className="flex gap-3 mt-4 justify-center">
              <button 
                onClick={() => setView('landing')}
                className="px-4 py-2 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition text-sm"
              >
                Меню
              </button>
              <button 
                onClick={startNewGame}
                className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-400 transition text-sm flex items-center gap-1"
              >
                <RefreshIcon /> Ещё раз
              </button>
            </div>
          </motion.div>
        )}

        {!isGameOver && (
          <div className="w-full max-w-lg mt-4">
            <Keyboard 
              onChar={handleChar} 
              onDelete={handleDelete} 
              onEnter={handleEnter}
              letterStatuses={keyStatuses}
            />
          </div>
        )}
      </div>
    );
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-200 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <LoaderIcon />
          <p className="text-indigo-600 mt-2 font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderAuthModal()}
      {renderRulesModal()}
      {view === 'landing' && renderLanding()}
      {view === 'game' && renderGame()}
      {view === 'profile' && renderProfile()}
      {view === 'review' && renderReview()}
      {view === 'anagram' && <AnagramGame onBack={() => setView('landing')} userProfile={userProfile} onWinCoins={handleWinCoins} onAddXP={addXP} />}
      {view === 'sprint' && <SprintGame onBack={() => setView('landing')} userProfile={userProfile} onWinCoins={handleWinCoins} onAddXP={addXP} />}
      {view === 'memory' && <MemoryGame onBack={() => setView('landing')} userProfile={userProfile} onWinCoins={handleWinCoins} onAddXP={addXP} />}
      {view === 'hangman' && <HangmanGame onBack={() => setView('landing')} userProfile={userProfile} onWinCoins={handleWinCoins} onAddXP={addXP} />}
      {view === 'shop' && <Shop onBack={() => setView('landing')} userProfile={userProfile} onBuyItem={handleBuyItem} onUseItem={handleUseItem} />}
      {view === 'petroom' && <PetRoom onBack={() => setView('landing')} userProfile={userProfile} onUseItem={handleUseItem} />}
    </div>
  );
};

export default App;
