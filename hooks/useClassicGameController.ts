import { useCallback, useEffect, useState } from 'react';
import { MAX_GUESSES } from '../constants';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { getBestEliminationHint } from '../services/hintService';
import { CharStatus, EnrichedWord, GameSettings, GameState, ViewState } from '../types';

interface UseClassicGameControllerArgs {
  route: ViewState;
  settings: GameSettings;
  getSecretWordPool: () => EnrichedWord[];
  getValidationPool: () => string[];
  getModeWords: () => string[];
  onRouteChange: (route: ViewState) => void;
  onStatsUpdate: (won: boolean, word: string, coinsAdjustment?: number) => Promise<void>;
}

const WORDLE_HINT_COST = 1;

const scrollGameViewportToTop = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const run = () => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    try {
      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    } catch {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
  else run();
};

export const createInitialGameState = (): GameState => ({
  secretWord: '',
  secretWordData: null,
  guesses: [],
  history: [],
  currentGuess: '',
  gameStatus: 'playing',
  rowIndex: 0,
  hint: null,
  loadingHint: false,
  hintCoinsSpent: 0,
  error: null,
});

export const getGuessLetterStatuses = (guess: string, secretWord: string): CharStatus[] => {
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

export const getUpdatedKeyStatuses = (
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

export const useClassicGameController = ({
  route,
  settings,
  getSecretWordPool,
  getValidationPool,
  getModeWords,
  onRouteChange,
  onStatsUpdate,
}: UseClassicGameControllerArgs) => {
  const [setupError, setSetupError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, CharStatus>>({});
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);

  useEffect(() => {
    setSetupError(null);
  }, [settings]);

  useEffect(() => {
    if (route === 'game') scrollGameViewportToTop();
  }, [route, gameState.secretWord]);

  const startNewGame = useCallback(() => {
    setSetupError(null);
    const rawPool = getSecretWordPool();

    if (settings.dictionarySource === 'custom' && rawPool.length === 0) {
      setSetupError('Мой словарь не загружен. Загрузите TXT/CSV-файл или выберите встроенный словарь.');
      return;
    }

    const filteredPool = rawPool.filter(entry => entry.word.length === settings.wordLength);

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
    onRouteChange('game');
    scrollGameViewportToTop();
  }, [getSecretWordPool, onRouteChange, settings.dictionarySource, settings.difficulty, settings.wordLength]);

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

    if (nextStatus !== 'playing') {
      const hintCoinsSpent = gameState.hintCoinsSpent ?? 0;
      if (hintCoinsSpent > 0) await onStatsUpdate(nextStatus === 'won', gameState.secretWord, -hintCoinsSpent);
      else await onStatsUpdate(nextStatus === 'won', gameState.secretWord);
    }
  }, [gameState, getValidationPool, onStatsUpdate, settings.wordLength, triggerShake]);

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
    if (gameState.gameStatus !== 'playing' || gameState.loadingHint) return;
    const hintPool = getModeWords().filter(word => word.length === settings.wordLength);

    setGameState(prev => ({ ...prev, loadingHint: true }));
    window.setTimeout(() => {
      const bestWord = getBestEliminationHint(gameState.secretWord, gameState.guesses, hintPool);
      setGameState(prev => ({
        ...prev,
        hint: bestWord ? `Попробуйте слово: ${bestWord}` : 'Нет подходящих слов для подсказки.',
        loadingHint: false,
        hintCoinsSpent: bestWord ? (prev.hintCoinsSpent ?? 0) + WORDLE_HINT_COST : (prev.hintCoinsSpent ?? 0),
      }));
    }, 500);
  }, [gameState.gameStatus, gameState.guesses, gameState.loadingHint, gameState.secretWord, getModeWords, settings.wordLength]);

  return {
    setupError,
    gameState,
    keyStatuses,
    shakeRowIndex,
    startNewGame,
    handleChar,
    handleDelete,
    handleEnter,
    fetchHint,
  };
};