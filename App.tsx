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

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<ViewState>('landing');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
 // NEW: Jail Modal state
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
  const [userProfile, setUserProfile] = useState<UserProfile>({
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
  });

  // Safety timeout for auth loading
  useEffect(() => {
    let timeout: any;
    if (isAuthLoading) {
      timeout = setTimeout(() => {
        console.warn("Auth loading timed out after 8s. Forcing entry as guest.");
        setIsAuthLoading(false);
        setShowLoginModal(false);
        // If we don't have a profile yet, set a basic one so the app doesn't crash
        if (!userProfile || userProfile.username === 'Guest') {
          setUserProfile({
            username: 'Guest',
            role: 'user',
            customDictionaryEn: [],
            stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
            pet: { 
              name: 'Owl', 
              type: 'Owl',
              level: 1, 
              mood: 'happy', 
              xp: 0, 
              hunger: 100, 
              energy: 100,
              equippedAccessories: []
            },
            coins: 100,
            inventory: []
          });
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

  // Auto-scroll history
  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
    }
  }, [gameState.history]);

  // Clear setup error when settings change
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
          
          // Close modal and stop loading if we have a user
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

  const handleYandexLogin = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'yandex' as any,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || "Ошибка при входе через Яндекс");
      setIsAuthLoading(false);
    }
  };

  // Remove the old message listener for Yandex since Supabase handles it via OAuth redirect
  useEffect(() => {
    // This can be empty now or removed
  }, []);

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
      setSettings(prev => ({ 
        ...prev, 
        username: 'Guest',
        dictionarySource: 'builtin', // Reset to builtin on logout
        useCustomDictionary: false
      }));
      setUserProfile({
        username: 'Guest',
        customDictionaryEn: [],
        stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
        pet: { name: 'Owl', level: 1, mood: 'neutral', xp: 0 }
      });
      setView('landing');
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const addXP = async (amount: number) => {
    if (!currentUser) return;
    const newPet: PetState = { ...userProfile.pet, xp: userProfile.pet.xp + amount };
    // Level up logic
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

  // 1. POOL FOR SECRET WORD
  const getSecretWordPool = useCallback(() => {
     let pool: EnrichedWord[] = [];
     if (settings.dictionarySource === 'custom' && userProfile.customDictionaryEn.length > 0) {
        // Custom dictionary are plain strings.
        pool = userProfile.customDictionaryEn.map(w => ({ word: w.toUpperCase(), translation: '', level: 'Custom' }));
     } else {
        // Built-in Dictionary with Difficulty Filter
        pool = COMMON_WORDS_EN;
        if (settings.difficulty !== 'ALL') {
          pool = pool.filter(w => w.level === settings.difficulty);
        }
        pool = pool.map(w => ({ ...w, word: w.word.toUpperCase() }));
     }
     
     // Filter out words ending in 'S' (plural/3rd person) as requested
     // We keep words ending in 'SS' as they are usually not plurals (e.g., GLASS, BOSS)
     return pool.filter(w => !w.word.endsWith('S') || w.word.endsWith('SS'));
  }, [settings.dictionarySource, settings.difficulty, userProfile.customDictionaryEn]);

  // 2. POOL FOR VALIDATION
  const getValidationPool = useCallback(() => {
    const basePool = ALL_WORDS_EN;
    let combinedPool = basePool.filter(w => w.length === settings.wordLength).map(w => w.toUpperCase());

    // Add Custom Dictionary words
    if (userProfile.customDictionaryEn.length > 0) {
       const customFiltered = userProfile.customDictionaryEn
         .filter(w => w.length === settings.wordLength)
         .map(w => w.toUpperCase());
       combinedPool = [...combinedPool, ...customFiltered];
    }

    // Deduplicate
    return Array.from(new Set(combinedPool));
  }, [settings.wordLength, userProfile.customDictionaryEn]);


  const startNewGame = useCallback(() => {
    setSetupError(null);
    const rawPool = getSecretWordPool();
    
    // Filter by length
    // rawPool is always EnrichedWord[] because getSecretWordPool normalizes all inputs.
    const filteredPool = rawPool.filter(w => w.word.length === settings.wordLength);
    
    if (filteredPool.length === 0) {
      let msg = "Слов с такими настройками не найдено.";
      if (settings.dictionarySource === 'custom') {
        msg = `В вашем словаре нет слов длиной ${settings.wordLength}.`;
      } else {
        msg = `В словаре нет слов уровня ${settings.difficulty} длиной ${settings.wordLength}.`;
      }
      setSetupError(msg);
      return; // Stop here, do not change view to game
    }
    
    // If we have words, pick one
    let secretWord = '';
    let secretWordData: EnrichedWord | null = null;

    if (filteredPool.length > 0) {
      // Prioritize Words from Jail? (Mechanic 1 from suggestions)
      // For now, simple random
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
    if (!currentUser) return; // Guest stats are not persisted

    const newStats: UserStats = { ...userProfile.stats };
    newStats.gamesPlayed += 1;
    if (won) {
      newStats.gamesWon += 1;
      newStats.wordsGuessed[word] = (newStats.wordsGuessed[word] || 0) + 1;
      addXP(50); // Give XP for Wordle win
      handleWinCoins(20); // Give coins for Wordle win
    }
    
    // Save locally immediately
    setUserProfile(prev => ({ ...prev, stats: newStats }));

    try {
      await userService.updateUserStats(currentUser.id, newStats);
    } catch (e) {
      console.error("Failed to sync stats to server", e);
    }
  };

  // --- NEW: Jail Logic ---


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
      // --- NEW: MISTAKE TRAPPING ---
      // User entered an invalid word. Check for typos.
      
      // Determine which pool to search for typos based on the active dictionary
      let typoSearchPool = validWords; // Default to all valid words
      
      if (settings.dictionarySource === 'custom') {
         // STRICTLY use custom dictionary for typo suggestions in this mode
         typoSearchPool = userProfile.customDictionaryEn;
      }
      
      // Only look for words of the correct length to ensure valid suggestions for the game format
      const relevantPool = typoSearchPool.filter(w => w.length === settings.wordLength);

      setGameState(prev => ({ ...prev, error: "Такого слова нет в словаре" }));
      triggerShake();
      return;
    }

    // --- EXISTING GAME LOGIC ---
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
    
    // Calculate which dictionary to use for the hint pool
    let hintPool: string[] = [];

    if (settings.dictionarySource === 'custom' && userProfile.customDictionaryEn.length > 0) {
      hintPool = userProfile.customDictionaryEn;
    } else {
      // Built-in Dictionary: Use ALL words for hints to allow powerful elimination
      hintPool = COMMON_WORDS_EN.map(w => w.word);
    }

    // Filter potential hints by current word length
    hintPool = hintPool.filter(w => w.length === settings.wordLength);

    setGameState(prev => ({ ...prev, loadingHint: true }));
    
    // Simulate a brief "thinking" delay for UX consistency
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
            {/* Modal Header */}
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

            {/* Error Message */}
            {authError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
                 ⚠️ {authError}
              </div>
            )}

            {/* Form */}
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
                  onClick={handleGoogleLogin}
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 active:scale-[0.98] transition flex justify-center items-center gap-2"
                >
                  <GoogleIcon />
                  Войти через Google
                </button>

                <button 
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

            {/* Footer Toggle */}
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
        
        {/* Header */}
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

        {/* List Content */}
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

        {/* Footer Actions */}
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
      
      {/* Top Bar */}
      <div className="w-full flex justify-between px-2 sm:px-8 pt-4 mb-2 gap-2">
         <div className="flex gap-2">
           {/* Rules Button */}
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

         {/* User/Auth Button */}
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

      {/* Stats Bar (Coins, XP, Level) */}
      {settings.username !== 'Guest' && (
        <div className="w-full max-w-2xl px-2 sm:px-8 mb-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg border-2 border-white flex justify-between items-center gap-4">
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
              <span className="text-xl">💰</span>
              <span className="font-black text-amber-700">{userProfile.coins}</span>
            </div>
            
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                <span>Уровень {userProfile.pet.level}</span>
                <span>{userProfile.pet.xp} / {userProfile.pet.level * 100} XP</span>
              </div>
              <div className="h-2 bg-indigo-50 rounded-full overflow-hidden border border-indigo-100">
                <motion.div 
                  className="h-full bg-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(userProfile.pet.xp / (userProfile.pet.level * 100)) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-100">
              <span className="text-xl">⭐</span>
              <span className="font-black text-pink-700">{userProfile.pet.level}</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-8 animate-bounce-in">
        <h1 className="text-6xl font-black tracking-tighter text-indigo-900 mb-2 drop-shadow-md">
          ✨ ANN<span className="text-pink-500">WORD</span> ✨
        </h1>
        <p className="text-indigo-700 font-bold text-lg bg-white/50 inline-block px-4 py-1 rounded-full">Магия английских слов!</p>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        {/* Settings Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-xl border-4 border-white">
          <h2 className="text-2xl font-black text-indigo-800 mb-4 flex items-center gap-2">
            ⚙️ Опции
          </h2>
          
          <div className="space-y-6">
            {/* Dictionary Source */}
            <div>
              <label className="block text-sm font-bold text-indigo-400 uppercase mb-2">Какой словарь используем?</label>
              <div className="flex flex-col sm:flex-row bg-indigo-50 p-1.5 rounded-2xl gap-1.5">
                <button 
                  onClick={() => setSettings(s => ({ ...s, dictionarySource: 'builtin', useCustomDictionary: false }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${settings.dictionarySource === 'builtin' ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]' : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100/50'}`}
                >
                  🏫 Школьный
                </button>
                <button 
                  onClick={() => {
                    if (settings.username === 'Guest') {
                        setAuthError("Для доступа к своему словарю необходимо войти в аккаунт");
                        setAuthMode('login');
                        setShowLoginModal(true);
                    } else {
                        setSettings(s => ({ ...s, dictionarySource: 'custom', useCustomDictionary: true }));
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                    settings.dictionarySource === 'custom' 
                      ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]' 
                      : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100/50'
                  }`}
                >
                  {settings.username === 'Guest' && <LockIcon />}
                  🎒 Мой словарь
                </button>
              </div>
            </div>

            {/* Difficulty (Only for Built-in) */}
            {settings.dictionarySource === 'builtin' && (
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-indigo-400 uppercase mb-2">Уровень сложности</label>
                <div className="flex flex-wrap gap-2">
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'ALL'] as DifficultyLevel[]).map(level => (
                    <button
                      key={level}
                      onClick={() => setSettings(s => ({ ...s, difficulty: level }))}
                      className={`flex-1 min-w-[60px] py-2 rounded-xl text-sm font-bold border-2 transition ${
                        settings.difficulty === level 
                          ? 'border-pink-400 bg-pink-50 text-pink-600 shadow-sm' 
                          : 'border-transparent bg-indigo-50 text-indigo-400 hover:bg-indigo-100'
                      }`}
                    >
                      {level === 'ALL' ? 'Все' : level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Dict Upload */}
            {settings.dictionarySource === 'custom' && (
              <div className="animate-fade-in bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
                <label className="block text-sm font-bold text-yellow-800 mb-2">Загрузить свои слова (.txt)</label>
                {isUploadingDict ? (
                   <div className="flex items-center gap-2 text-sm text-yellow-700 animate-pulse py-2">
                     <LoaderIcon /> Загрузка...
                   </div>
                ) : (
                  <input 
                    type="file" 
                    accept=".txt" 
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-yellow-200 file:text-yellow-800 hover:file:bg-yellow-300 cursor-pointer"
                  />
                )}
                <p className="text-sm font-bold text-yellow-600/80 mt-2">
                  В словаре: {userProfile.customDictionaryEn.length > 0 ? `${userProfile.customDictionaryEn.length} слов` : 'Пусто'}
                </p>
              </div>
            )}

            {/* Validation Error Message */}
            {setupError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm font-bold animate-bounce-in text-center">
                ⚠️ {setupError}
              </div>
            )}
          </div>
        </div>

        {/* Games Grid */}
        <div>
          <h2 className="text-2xl font-black text-indigo-900 mb-4 text-center drop-shadow-sm">
            Во что будем играть?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wordle Game */}
            <div className="bg-white border-b-4 border-green-200 rounded-3xl p-6 shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
              <div className="text-5xl mb-3">🧩</div>
              <h2 className="text-xl font-black text-gray-800">Wordle</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium text-center mb-4">Угадай слово по буквам</p>
              
              {/* Word Length Selector */}
              <div className="w-full mb-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">Длина слова</label>
                <div className="flex gap-2 justify-center">
                  {[4, 5, 6].map(len => (
                    <button
                      key={len}
                      onClick={(e) => { e.stopPropagation(); setSettings(s => ({...s, wordLength: len as WordLength})); }}
                      className={`w-10 h-10 rounded-xl font-black text-sm border-b-2 transition transform active:scale-95 ${
                        settings.wordLength === len 
                          ? 'border-green-600 bg-green-500 text-white shadow-md translate-y-0.5' 
                          : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={startNewGame}
                className="w-full py-3 bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800 rounded-xl font-bold transition-colors"
              >
                Играть
              </button>
            </div>

            {/* Anagrams Game */}
            <button 
              onClick={() => setView('anagrams')}
              className="group bg-white border-b-4 border-purple-200 hover:border-purple-400 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center flex flex-col items-center justify-center"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🔤</div>
              <h2 className="text-xl font-black text-gray-800 group-hover:text-purple-500">Анаграммы</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium">Собери слово из букв</p>
            </button>

            {/* Sprint Game */}
            <button 
              onClick={() => setView('sprint')}
              className="group bg-white border-b-4 border-amber-200 hover:border-amber-400 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center flex flex-col items-center justify-center"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">⚡</div>
              <h2 className="text-xl font-black text-gray-800 group-hover:text-amber-500">Спринт</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium">Переведи слова на скорость</p>
            </button>

            {/* Hangman Game */}
            <button 
              onClick={() => setView('hangman')}
              className="group bg-white border-b-4 border-sky-200 hover:border-sky-400 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center flex flex-col items-center justify-center"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🌤️</div>
              <h2 className="text-xl font-black text-gray-800 group-hover:text-sky-500">Солнышко</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium">Спаси солнце от тучек</p>
            </button>

            {/* Memory Game */}
            <button 
              onClick={() => setView('memory')}
              className="group bg-white border-b-4 border-yellow-200 hover:border-yellow-400 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center flex flex-col items-center justify-center"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🧠</div>
              <h2 className="text-xl font-black text-gray-800 group-hover:text-yellow-500">Мемо</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium">Найди пары слов</p>
            </button>

            {/* Shop */}
            <button 
              onClick={() => setView('shop')}
              className="group bg-white border-b-4 border-indigo-200 hover:border-indigo-400 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center flex flex-col items-center justify-center"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🛒</div>
              <h2 className="text-xl font-black text-gray-800 group-hover:text-indigo-500">Магазин</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium">Еда и аксессуары</p>
            </button>

            {/* Pet Room */}
            <button 
              onClick={() => setView('pet_room')}
              className="group bg-white border-b-4 border-pink-200 hover:border-pink-400 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center flex flex-col items-center justify-center"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🏠</div>
              <h2 className="text-xl font-black text-gray-800 group-hover:text-pink-500">Комната</h2>
              <p className="text-gray-400 text-xs mt-2 font-medium">Покорми питомца</p>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  const renderGame = () => (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden relative">
      <header className="w-full border-b bg-white p-4 flex justify-between items-center shadow-sm z-10 shrink-0">
        <button 
          onClick={() => setView('landing')} 
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-bold transition px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="text-xl">←</span> Меню
        </button>
        <h1 className="text-2xl font-bold tracking-wider">
          ANN<span className="text-green-600">WORD</span>
        </h1>
        <div className="w-16"></div>
      </header>
      
      {/* Error Toast */}
      <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${gameState.error ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-black text-white px-4 py-2 rounded-md font-bold shadow-lg">
          {gameState.error}
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-between w-full max-w-lg mx-auto p-2 overflow-hidden">
        
        {/* --- English specific: Translation History Ticker & Hints --- */}
        {gameState.gameStatus === 'playing' && (
           <div className="w-full mb-1 shrink-0 flex flex-col items-center gap-1">
             
             {/* History Ticker - COMPACT FOR MOBILE */}
             {gameState.history.length > 0 && (
               <div 
                 ref={historyScrollRef}
                 className="w-full overflow-x-auto whitespace-nowrap no-scrollbar py-1 px-2 flex gap-2"
               >
                 {gameState.history.map((item, idx) => (
                   <div key={idx} className="inline-flex items-center bg-white border border-indigo-100 rounded-lg shadow-sm px-2 py-1 animate-bounce-in">
                     <span className="font-bold text-gray-800 text-xs">{item.word}</span>
                     {item.translation && (
                       <>
                         <span className="mx-1 text-gray-300 text-xs">|</span>
                         <span className="text-indigo-600 text-xs max-w-[80px] truncate">{item.translation}</span>
                       </>
                     )}
                   </div>
                 ))}
               </div>
             )}

             {/* Hint Button - COMPACT */}
             {!gameState.hint && !gameState.loadingHint ? (
               <button 
                onClick={fetchHint}
                className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full font-semibold hover:bg-indigo-100 transition shadow-sm"
               >
                 💡 Подсказка
               </button>
             ) : gameState.loadingHint ? (
               <div className="bg-indigo-50 border border-indigo-100 text-indigo-500 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2">
                 <LoaderIcon /> Думаю...
               </div>
             ) : (
               <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg text-xs text-center shadow-sm animate-fade-in w-full max-h-16 overflow-y-auto">
                 <span className="font-bold">Подсказка:</span> {gameState.hint}
               </div>
             )}
           </div>
        )}

        {/* Grid Container - Use flex-1 to take remaining space but don't exceed it */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          <div className="transform scale-90 sm:scale-100 origin-center">
            <Grid 
              guesses={gameState.guesses}
              currentGuess={gameState.currentGuess}
              secretWord={gameState.secretWord}
              wordLength={settings.wordLength}
              maxGuesses={MAX_GUESSES}
              shakeRowIndex={shakeRowIndex}
            />
          </div>
        </div>

        {gameState.gameStatus !== 'playing' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 p-4 bg-white/95 backdrop-blur rounded-lg shadow-2xl border text-center animate-bounce-in w-11/12 max-w-sm">
             <h2 className="text-xl font-bold mb-2">
               {gameState.gameStatus === 'won' ? '🎉 Победа!' : '😔 Вы проиграли'}
             </h2>
             <p className="mb-2 text-gray-700">
               Загаданное слово: <span className="font-bold text-black text-lg">{gameState.secretWord}</span>
             </p>
             {/* Show Translation and Level if available */}
             {gameState.secretWordData && (
                <div className="mb-4 text-sm">
                  <span className="block text-gray-500">Перевод: <span className="text-indigo-600 font-semibold">{gameState.secretWordData.translation}</span></span>
                  <span className="block text-gray-500 text-xs mt-1">Уровень: <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-bold">{gameState.secretWordData.level}</span></span>
                </div>
             )}
             <div className="flex flex-col gap-2">
                 <button 
                   onClick={() => setView('review')}
                   className="w-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-3 rounded-lg font-bold hover:bg-indigo-100 transition flex items-center justify-center gap-2"
                 >
                   <ListIcon /> Посмотреть слова
                 </button>
                 <div className="flex gap-2 justify-center">
                    <button 
                      onClick={() => setView('landing')}
                      className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                      Меню
                    </button>
                    <button 
                      onClick={startNewGame}
                      className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2 transition shadow-md"
                    >
                      <RefreshIcon /> Играть снова
                    </button>
                 </div>
             </div>
          </div>
        )}
      </main>

      <footer className="w-full bg-gray-100 pb-6 pt-2 border-t flex justify-center shrink-0">
         <Keyboard 
           onChar={handleChar} 
           onDelete={handleDelete} 
           onEnter={handleEnter} 
           letterStatuses={keyStatuses}
         />
      </footer>
    </div>
  );

  // --- Main Switch ---
  let content;
  if (view === 'landing') content = renderLanding();
  else if (view === 'profile') content = renderProfile();
  else if (view === 'review') content = renderReview();
  else if (view === 'admin') content = <AdminDashboard onBack={() => setView('landing')} />;
  else if (view === 'shop') content = (
    <div className="min-h-screen bg-indigo-50 p-4">
      <Shop 
        userProfile={userProfile} 
        onBuy={handleBuyItem} 
        onClose={() => setView('landing')} 
      />
    </div>
  );
  else if (view === 'pet_room') content = (
    <div className="min-h-screen bg-indigo-50 p-4">
      <PetRoom 
        userProfile={userProfile} 
        onUseItem={handleUseItem} 
        onClose={() => setView('landing')} 
      />
    </div>
  );
  else if (view === 'memory') content = (
    <div className="min-h-screen bg-indigo-50 p-4">
      <MemoryGame 
        onWin={handleWinCoins} 
        onClose={() => setView('landing')} 
      />
    </div>
  );
  else if (view === 'anagrams') content = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <AnagramGame 
        dictionary={getSecretWordPool()} 
        onBack={() => setView('landing')} 
        pet={userProfile.pet}
        onSuccess={addXP}
        onWinCoins={handleWinCoins}
      />
    </div>
  );
  else if (view === 'sprint') content = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <SprintGame 
        dictionary={getSecretWordPool()}
        onBack={() => setView('landing')} 
        pet={userProfile.pet}
        onSuccess={addXP}
        onWinCoins={handleWinCoins}
      />
    </div>
  );
  else if (view === 'hangman') content = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <HangmanGame 
        dictionary={getSecretWordPool()}
        onBack={() => setView('landing')} 
        pet={userProfile.pet}
        onSuccess={addXP}
        onWinCoins={handleWinCoins}
      />
    </div>
  );
  else content = renderGame();

  return (
    <>
      {renderAuthModal()}
      {renderRulesModal()}
      
      {/* Pet is visible in landing and setup views. 
          Hidden in game view to avoid overlapping keyboard/grid on mobile. */}
      {userProfile.username !== 'Guest' && (view === 'landing') && (
        <PetWidget 
          pet={userProfile.pet} 
          onClick={() => setView('pet_room')}
        />
      )}



      {content}
    </>
  );
};

const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await userService.getAllUsersStats();
        setUsers(data);
      } catch (err) {
        console.error("Failed to fetch admin stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-indigo-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
             <div className="text-4xl">🛡️</div>
             <h1 className="text-3xl font-black text-indigo-900">Панель администратора</h1>
          </div>
          <button 
            onClick={onBack}
            className="p-3 bg-white rounded-2xl shadow-md hover:bg-gray-100 transition-all transform active:scale-95 border-b-4 border-gray-200"
          >
            <BackIcon />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <LoaderIcon />
            <p className="text-indigo-400 font-bold animate-pulse">Загрузка статистики...</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border-4 border-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-indigo-900 text-white">
                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Пользователь</th>
                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Роль</th>
                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-center">Игр</th>
                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-center">Побед</th>
                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Питомец</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50">
                  {users.map((user, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="font-black text-indigo-900">{user.username}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border-b-2 ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-700 border-red-200' 
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {user.role || 'user'}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <span className="font-black text-indigo-900 bg-indigo-50 px-3 py-1 rounded-lg">
                          {user.stats.gamesPlayed}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <span className="font-black text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                          {user.stats.gamesWon}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🦉</span>
                          <div className="text-xs">
                            <div className="font-black text-indigo-900">{user.pet.name}</div>
                            <div className="text-indigo-400 font-bold">Lvl {user.pet.level}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="py-20 text-center text-indigo-300 font-bold">
                Пользователей пока нет 🤷‍♂️
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;