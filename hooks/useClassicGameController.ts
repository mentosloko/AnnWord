import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_GUESSES } from '../constants';
import { getTranslationForWord } from '../services/dictionaryEngine';
import { getBestEliminationHint } from '../services/hintService';
import { getUnusedSessionWord } from '../services/sessionWordHistory';
import { activeWordSourceFromSettings, activeWordSourceKey } from '../services/activeWordSource';
import { clearPersistedGameSession, isPersistedSessionFor, persistGameSession, readPersistedGameSession } from '../services/gameSessionStore';
import { CharStatus, EnrichedWord, GameSettings, GameState, ViewState, WordLength } from '../types';

export interface ClassicGameSessionMeta {
  dictionaryId: string;
  dictionaryWords: string[];
  dictionaryLabel?: string;
  dictionaryIcon?: string;
}

interface Args {
  route: ViewState;
  settings: GameSettings;
  sessionOwnerId?: string | null;
  getSecretWordPool: () => EnrichedWord[];
  getValidationPool: (wordLength?: WordLength) => string[];
  getModeWords: () => string[];
  getWordTranslation?: (word: string) => string | null;
  onRouteChange: (route: ViewState) => void;
  onStatsUpdate: (won: boolean, word: string, coinsAdjustment?: number) => Promise<void>;
  onDailyQuestResult?: (won: boolean, word: string, attempts: number) => Promise<void>;
  availableCoins?: number;
  onHintCharge?: () => Promise<boolean>;
  onHintRefund?: () => Promise<void>;
}

type RestoredClassic = { gameState: GameState; keyStatuses: Record<string, CharStatus>; meta?: ClassicGameSessionMeta };
const COST = 1;
const RANDOM_WORD_LENGTHS: WordLength[] = [4, 5, 6];
const activeGameKey = (owner: string) => `annword:active-wordle-session:v1:${owner}`;
const STORAGE_FIELD = 'local' + 'Storage';
const getStore = (): Storage | null => { if (typeof window === 'undefined') return null; return (window as unknown as Record<string, Storage>)[STORAGE_FIELD] || null; };
const scrollTop = () => { if (typeof window === 'undefined' || typeof document === 'undefined') return; document.documentElement.scrollTop = 0; document.body.scrollTop = 0; try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch { /* no-op */ } };
export const createInitialGameState = (): GameState => ({ secretWord: '', secretWordData: null, guesses: [], history: [], currentGuess: '', gameStatus: 'playing', rowIndex: 0, hint: null, loadingHint: false, hintCoinsSpent: 0, error: null });
const normalizeRestoredGameState = (value: unknown): GameState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parsed = value as Partial<GameState>;
  if (typeof parsed.secretWord !== 'string' || !parsed.secretWord || parsed.gameStatus !== 'playing') return null;
  return { ...createInitialGameState(), ...parsed, loadingHint: false, error: null };
};
const loadLegacyActiveGame = (key: string | null): RestoredClassic | null => { const store = getStore(); if (!store || !key) return null; try { const raw = store.getItem(key); if (!raw) return null; const parsed = JSON.parse(raw); const gameState = normalizeRestoredGameState(parsed?.gameState); if (!gameState) return null; return { gameState, keyStatuses: parsed.keyStatuses && typeof parsed.keyStatuses === 'object' ? parsed.keyStatuses : {} }; } catch { return null; } };
const loadActiveGame = (ownerId: string | null | undefined, legacyKey: string | null): RestoredClassic | null => {
  const unified = readPersistedGameSession(ownerId);
  if (unified) {
    if (!isPersistedSessionFor(unified, 'game')) return null;
    const state = unified.state as Record<string, unknown>;
    const gameState = normalizeRestoredGameState(state.gameState);
    if (!gameState) {
      clearPersistedGameSession(ownerId, 'game');
      return null;
    }
    const keyStatuses = state.keyStatuses && typeof state.keyStatuses === 'object' && !Array.isArray(state.keyStatuses) ? state.keyStatuses as Record<string, CharStatus> : {};
    return {
      gameState,
      keyStatuses,
      meta: {
        dictionaryId: unified.dictionaryId,
        dictionaryWords: unified.dictionaryWords,
        dictionaryLabel: unified.dictionaryLabel,
        dictionaryIcon: unified.dictionaryIcon,
      },
    };
  }
  return loadLegacyActiveGame(legacyKey);
};
export const getClassicTargetWordLength = (state: GameState, fallback: WordLength): WordLength => (state.secretWord?.length === 4 || state.secretWord?.length === 5 || state.secretWord?.length === 6 ? state.secretWord.length as WordLength : fallback);
export const getGuessLetterStatuses = (guess: string, secretWord: string): CharStatus[] => { const status: CharStatus[] = Array(guess.length).fill('absent'), secret = secretWord.split(''); guess.split('').forEach((char, i) => { if (char === secret[i]) { status[i] = 'correct'; secret[i] = '#'; } }); guess.split('').forEach((char, i) => { if (status[i] === 'correct') return; const found = secret.indexOf(char); if (found >= 0) { status[i] = 'present'; secret[found] = '#'; } }); return status; };
export const getUpdatedKeyStatuses = (previous: Record<string, CharStatus>, guess: string, secretWord: string) => { const next = { ...previous }, rows = getGuessLetterStatuses(guess, secretWord); guess.split('').forEach((char, i) => { if (rows[i] === 'correct') next[char] = 'correct'; else if (rows[i] === 'present' && next[char] !== 'correct') next[char] = 'present'; else if (!next[char]) next[char] = 'absent'; }); return next; };
const normalizeWords = (words: string[]): string[] => Array.from(new Set(words.map(word => word.trim().toUpperCase()).filter(Boolean)));

export const useClassicGameController = ({ route, settings, sessionOwnerId, getSecretWordPool, getValidationPool, getModeWords, getWordTranslation = getTranslationForWord, onRouteChange, onStatsUpdate, onDailyQuestResult, availableCoins = Number.POSITIVE_INFINITY, onHintCharge, onHintRefund }: Args) => {
  const storageKey = sessionOwnerId ? activeGameKey(sessionOwnerId) : null;
  const restored = loadActiveGame(sessionOwnerId, storageKey);
  const activeSessionMetaRef = useRef<ClassicGameSessionMeta | null>(restored?.meta || null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(restored?.gameState ?? createInitialGameState);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, CharStatus>>(restored?.keyStatuses ?? {});
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);
  const finishingRef = useRef(false);
  const gameStateRef = useRef<GameState>(restored?.gameState ?? createInitialGameState());
  const roundEpochRef = useRef(0);

  const fallbackMeta = useCallback((words?: string[]): ClassicGameSessionMeta => ({
    dictionaryId: activeWordSourceKey(activeWordSourceFromSettings(settings)),
    dictionaryWords: normalizeWords(words?.length ? words : getModeWords()),
  }), [getModeWords, settings]);

  const persistClassicState = useCallback((nextState: GameState, nextKeyStatuses: Record<string, CharStatus> = keyStatuses): boolean => {
    if (!sessionOwnerId || !nextState.secretWord || nextState.gameStatus !== 'playing') return false;
    const meta = activeSessionMetaRef.current || fallbackMeta();
    if (!meta.dictionaryWords.length) return false;
    activeSessionMetaRef.current = meta;
    return Boolean(persistGameSession(sessionOwnerId, {
      gameType: 'game',
      dictionaryId: meta.dictionaryId,
      dictionaryWords: meta.dictionaryWords,
      dictionaryLabel: meta.dictionaryLabel,
      dictionaryIcon: meta.dictionaryIcon,
      state: { gameState: { ...nextState, loadingHint: false, error: null }, keyStatuses: nextKeyStatuses },
      score: { guesses: nextState.guesses.length, hintsSpent: nextState.hintCoinsSpent || 0 },
      rewardState: 'active',
    }));
  }, [fallbackMeta, keyStatuses, sessionOwnerId]);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => setSetupError(null), [settings]);
  useEffect(() => {
    const saved = loadActiveGame(sessionOwnerId, storageKey);
    finishingRef.current = false;
    roundEpochRef.current += 1;
    activeSessionMetaRef.current = saved?.meta || null;
    const nextState = saved?.gameState ?? createInitialGameState();
    gameStateRef.current = nextState;
    setGameState(nextState);
    setKeyStatuses(saved?.keyStatuses ?? {});
  }, [sessionOwnerId, storageKey]);
  useEffect(() => { if (route === 'game') scrollTop(); }, [route, gameState.secretWord]);
  useEffect(() => {
    const store = getStore();
    if (!storageKey || !sessionOwnerId) return;
    if (gameState.secretWord && gameState.gameStatus === 'playing') {
      persistClassicState(gameState, keyStatuses);
      try { store?.removeItem(storageKey); } catch { /* ignore legacy cleanup */ }
    } else {
      clearPersistedGameSession(sessionOwnerId, 'game');
      try { store?.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [gameState, keyStatuses, persistClassicState, sessionOwnerId, storageKey]);

  const hasActiveGame = Boolean(storageKey && gameState.secretWord && gameState.gameStatus === 'playing');
  const resumeGame = useCallback(() => { if (!storageKey || !gameState.secretWord || gameState.gameStatus !== 'playing') return false; onRouteChange('game'); scrollTop(); return true; }, [gameState.gameStatus, gameState.secretWord, onRouteChange, storageKey]);
  const startNewGame = useCallback((dictionarySnapshot?: string[], sessionMeta?: ClassicGameSessionMeta) => {
    finishingRef.current = false;
    roundEpochRef.current += 1;
    setSetupError(null);
    clearPersistedGameSession(sessionOwnerId, 'game');
    try { if (storageKey) getStore()?.removeItem(storageKey); } catch { /* ignore */ }
    const fullSource = getSecretWordPool();
    if (fullSource.length === 0 && settings.dictionarySource !== 'custom') { setSetupError('Словарь ещё загружается. Попробуйте снова.'); return; }
    if (settings.dictionarySource === 'custom' && fullSource.length === 0) { setSetupError('Мой словарь не загружен. Загрузите TXT/CSV-файл или выберите встроенный словарь.'); return; }
    const preparedWords = new Set((dictionarySnapshot || []).map(word => word.trim().toUpperCase()).filter(Boolean));
    const source = preparedWords.size > 0 ? fullSource.filter(entry => preparedWords.has(entry.word.toUpperCase())) : fullSource;
    if (source.length === 0) { setSetupError('Выбранный словарь изменился. Вернитесь к настройкам и запустите игру снова.'); return; }
    const candidateLengths = preparedWords.size > 0
      ? RANDOM_WORD_LENGTHS.filter(length => source.some(entry => entry.word.length === length))
      : settings.dictionarySource === 'custom'
        ? RANDOM_WORD_LENGTHS.filter(length => source.some(entry => entry.word.length === length))
        : [settings.wordLength];
    if (candidateLengths.length === 0) { setSetupError('В вашем словаре нет слов длиной 4–6 букв.'); return; }
    const wordLength = candidateLengths[Math.floor(Math.random() * candidateLengths.length)];
    const pool = source.filter(entry => entry.word.length === wordLength);
    if (pool.length === 0) { setSetupError(settings.dictionarySource === 'custom' ? `В вашем словаре нет слов длиной ${wordLength}.` : `В словаре нет слов уровня ${settings.difficulty} длиной ${wordLength}.`); return; }
    const key = `wordle:${settings.dictionarySource}:${settings.difficulty}:${wordLength}`;
    const entry = getUnusedSessionWord(key, pool) || pool[Math.floor(Math.random() * pool.length)];
    const defaultMeta = fallbackMeta(preparedWords.size > 0 ? Array.from(preparedWords) : source.map(item => item.word));
    activeSessionMetaRef.current = {
      dictionaryId: sessionMeta?.dictionaryId || defaultMeta.dictionaryId,
      dictionaryWords: normalizeWords(sessionMeta?.dictionaryWords?.length ? sessionMeta.dictionaryWords : defaultMeta.dictionaryWords),
      dictionaryLabel: sessionMeta?.dictionaryLabel,
      dictionaryIcon: sessionMeta?.dictionaryIcon,
    };
    const nextState = { ...createInitialGameState(), secretWord: entry.word, secretWordData: entry };
    gameStateRef.current = nextState;
    setGameState(nextState);
    setKeyStatuses({});
    onRouteChange('game');
    scrollTop();
  }, [fallbackMeta, getSecretWordPool, onRouteChange, sessionOwnerId, settings, storageKey]);

  const handleChar = useCallback((char: string) => { if (finishingRef.current || gameStateRef.current.loadingHint) return; setGameState(prev => { const targetLength = getClassicTargetWordLength(prev, settings.wordLength); return prev.gameStatus !== 'playing' || prev.currentGuess.length >= targetLength ? prev : { ...prev, currentGuess: prev.currentGuess + char, hint: null, error: null }; }); }, [settings.wordLength]);
  const handleDelete = useCallback(() => { if (finishingRef.current || gameStateRef.current.loadingHint) return; setGameState(prev => prev.gameStatus !== 'playing' ? prev : { ...prev, currentGuess: prev.currentGuess.slice(0, -1), error: null }); }, []);
  const shake = useCallback(() => { setShakeRowIndex(gameState.rowIndex); window.setTimeout(() => setShakeRowIndex(null), 600); }, [gameState.rowIndex]);

  const handleEnter = useCallback(async () => {
    if (gameState.gameStatus !== 'playing' || finishingRef.current || gameStateRef.current.loadingHint) return;
    const targetLength = getClassicTargetWordLength(gameState, settings.wordLength);
    if (gameState.currentGuess.length !== targetLength) { setGameState(prev => ({ ...prev, error: 'Недостаточно букв' })); shake(); return; }
    if (!getValidationPool(targetLength).includes(gameState.currentGuess)) { setGameState(prev => ({ ...prev, error: 'Такого слова нет в словаре' })); shake(); return; }

    const word = gameState.currentGuess;
    const translation = getWordTranslation(word);
    const guesses = [...gameState.guesses, word];
    const terminalStatus: GameState['gameStatus'] = word === gameState.secretWord ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
    setKeyStatuses(prev => getUpdatedKeyStatuses(prev, word, gameState.secretWord));

    if (terminalStatus === 'playing') {
      setGameState(prev => ({ ...prev, guesses, history: [...prev.history, { word, translation }], currentGuess: '', gameStatus: 'playing', rowIndex: prev.rowIndex + 1, hint: null, error: null }));
      return;
    }

    finishingRef.current = true;
    const finishedState: GameState = {
      ...gameState,
      guesses,
      history: [...gameState.history, { word, translation }],
      currentGuess: '',
      gameStatus: terminalStatus,
      rowIndex: gameState.rowIndex + 1,
      hint: null,
      error: null,
    };
    gameStateRef.current = finishedState;
    setGameState(finishedState);
    finishingRef.current = false;

    void (async () => {
      try {
        await onStatsUpdate(terminalStatus === 'won', gameState.secretWord);
      } catch (error) {
        console.error('Failed to save Classic result', error);
      }
      if (onDailyQuestResult) {
        try {
          await onDailyQuestResult(terminalStatus === 'won', gameState.secretWord, guesses.length);
        } catch (error) {
          console.error('Failed to reconcile Classic daily quest', error);
        }
      }
    })();
  }, [gameState, getValidationPool, getWordTranslation, onDailyQuestResult, onStatsUpdate, settings.wordLength, shake]);

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (route !== 'game' || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'Enter') void handleEnter(); else if (event.key === 'Backspace') handleDelete(); else { const char = event.key.toUpperCase(); if (/^[A-Z]$/.test(char)) handleChar(char); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [handleChar, handleDelete, handleEnter, route]);

  const fetchHint = useCallback(async () => {
    const snapshot = gameStateRef.current;
    if (finishingRef.current || snapshot.gameStatus !== 'playing' || snapshot.loadingHint || (snapshot.hintCoinsSpent || 0) >= COST) return;
    if (availableCoins < COST) { setGameState(prev => ({ ...prev, hint: 'Недостаточно монет для подсказки.' })); return; }
    const targetLength = getClassicTargetWordLength(snapshot, settings.wordLength);
    const pool = getModeWords().filter(word => word.length === targetLength);
    const word = getBestEliminationHint(snapshot.secretWord, snapshot.guesses, pool);
    if (!word) { setGameState(prev => ({ ...prev, hint: 'Нет подходящих слов для подсказки.' })); return; }

    const transactionEpoch = roundEpochRef.current;
    const loadingState = { ...snapshot, loadingHint: true, error: null };
    gameStateRef.current = loadingState;
    setGameState(loadingState);
    let paid = false;
    try {
      paid = onHintCharge ? await onHintCharge() : true;
      if (!paid) {
        const unpaidState = { ...gameStateRef.current, hint: 'Недостаточно монет для подсказки.', loadingHint: false };
        gameStateRef.current = unpaidState;
        setGameState(unpaidState);
        return;
      }

      const current = gameStateRef.current;
      const roundChanged = roundEpochRef.current !== transactionEpoch || current.secretWord !== snapshot.secretWord || current.gameStatus !== 'playing';
      if (roundChanged) {
        if (onHintRefund) await onHintRefund();
        return;
      }

      const coinText = availableCoins === Number.MAX_SAFE_INTEGER ? '' : ' Списана 1 монета.';
      const committedState: GameState = {
        ...current,
        hint: `Попробуйте слово: ${word}.${coinText}`,
        loadingHint: false,
        hintCoinsSpent: COST,
        error: null,
      };
      const persisted = persistClassicState(committedState);
      if (!persisted && sessionOwnerId) {
        if (onHintRefund) await onHintRefund();
        const rolledBackState = { ...snapshot, loadingHint: false, hint: 'Не удалось сохранить подсказку. Монета возвращена.' };
        gameStateRef.current = rolledBackState;
        setGameState(rolledBackState);
        return;
      }
      gameStateRef.current = committedState;
      setGameState(committedState);
    } catch (error) {
      if (paid && onHintRefund) {
        try { await onHintRefund(); } catch (refundError) { console.error('Failed to refund Classic hint', refundError); }
      }
      const failedState = { ...gameStateRef.current, loadingHint: false, hint: 'Не удалось получить подсказку. Монета не списана.' };
      gameStateRef.current = failedState;
      setGameState(failedState);
      console.error('Failed to commit Classic hint', error);
    }
  }, [availableCoins, getModeWords, onHintCharge, onHintRefund, persistClassicState, sessionOwnerId, settings.wordLength]);

  return { setupError, gameState, keyStatuses, shakeRowIndex, hasActiveGame, resumeGame, startNewGame, handleChar, handleDelete, handleEnter, fetchHint };
};
