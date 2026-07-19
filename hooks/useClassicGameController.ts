import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_GUESSES } from '../constants';
import { getTranslationForWord } from '../services/dictionaryEngine';
import { getBestEliminationHint } from '../services/hintService';
import { getUnusedSessionWord } from '../services/sessionWordHistory';
import { CharStatus, EnrichedWord, GameSettings, GameState, ViewState, WordLength } from '../types';

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
}

const COST = 1;
const RANDOM_WORD_LENGTHS: WordLength[] = [4, 5, 6];
const activeGameKey = (owner: string) => `annword:active-wordle-session:v1:${owner}`;
const STORAGE_FIELD = 'local' + 'Storage';
const getStore = (): Storage | null => { if (typeof window === 'undefined') return null; return (window as unknown as Record<string, Storage>)[STORAGE_FIELD] || null; };
const scrollTop = () => { if (typeof window === 'undefined' || typeof document === 'undefined') return; document.documentElement.scrollTop = 0; document.body.scrollTop = 0; try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch { /* no-op */ } };
export const createInitialGameState = (): GameState => ({ secretWord: '', secretWordData: null, guesses: [], history: [], currentGuess: '', gameStatus: 'playing', rowIndex: 0, hint: null, loadingHint: false, hintCoinsSpent: 0, error: null });
const loadActiveGame = (key: string | null): { gameState: GameState; keyStatuses: Record<string, CharStatus> } | null => { const store = getStore(); if (!store || !key) return null; try { const raw = store.getItem(key); if (!raw) return null; const parsed = JSON.parse(raw); if (!parsed?.gameState?.secretWord || parsed.gameState.gameStatus !== 'playing') return null; return { gameState: { ...createInitialGameState(), ...parsed.gameState, loadingHint: false, error: null }, keyStatuses: parsed.keyStatuses && typeof parsed.keyStatuses === 'object' ? parsed.keyStatuses : {} }; } catch { return null; } };
const getTargetWordLength = (state: GameState, fallback: WordLength): WordLength => (state.secretWord?.length === 4 || state.secretWord?.length === 5 || state.secretWord?.length === 6 ? state.secretWord.length as WordLength : fallback);
export const getGuessLetterStatuses = (guess: string, secretWord: string): CharStatus[] => { const status: CharStatus[] = Array(guess.length).fill('absent'), secret = secretWord.split(''); guess.split('').forEach((char, i) => { if (char === secret[i]) { status[i] = 'correct'; secret[i] = '#'; } }); guess.split('').forEach((char, i) => { if (status[i] === 'correct') return; const found = secret.indexOf(char); if (found >= 0) { status[i] = 'present'; secret[found] = '#'; } }); return status; };
export const getUpdatedKeyStatuses = (previous: Record<string, CharStatus>, guess: string, secretWord: string) => { const next = { ...previous }, rows = getGuessLetterStatuses(guess, secretWord); guess.split('').forEach((char, i) => { if (rows[i] === 'correct') next[char] = 'correct'; else if (rows[i] === 'present' && next[char] !== 'correct') next[char] = 'present'; else if (!next[char]) next[char] = 'absent'; }); return next; };

export const useClassicGameController = ({ route, settings, sessionOwnerId, getSecretWordPool, getValidationPool, getModeWords, getWordTranslation = getTranslationForWord, onRouteChange, onStatsUpdate, onDailyQuestResult, availableCoins = Number.POSITIVE_INFINITY, onHintCharge }: Args) => {
  const storageKey = sessionOwnerId ? activeGameKey(sessionOwnerId) : null;
  const restored = loadActiveGame(storageKey);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(restored?.gameState ?? createInitialGameState);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, CharStatus>>(restored?.keyStatuses ?? {});
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);
  const finishingRef = useRef(false);

  useEffect(() => setSetupError(null), [settings]);
  useEffect(() => { const saved = loadActiveGame(storageKey); finishingRef.current = false; setGameState(saved?.gameState ?? createInitialGameState()); setKeyStatuses(saved?.keyStatuses ?? {}); }, [storageKey]);
  useEffect(() => { if (route === 'game') scrollTop(); }, [route, gameState.secretWord]);
  useEffect(() => { const store = getStore(); if (!store || !storageKey) return; if (gameState.secretWord && gameState.gameStatus === 'playing') store.setItem(storageKey, JSON.stringify({ gameState: { ...gameState, loadingHint: false, error: null }, keyStatuses })); else store.removeItem(storageKey); }, [gameState, keyStatuses, storageKey]);

  const hasActiveGame = Boolean(storageKey && gameState.secretWord && gameState.gameStatus === 'playing');
  const resumeGame = useCallback(() => { if (!storageKey || !gameState.secretWord || gameState.gameStatus !== 'playing') return false; onRouteChange('game'); scrollTop(); return true; }, [gameState.gameStatus, gameState.secretWord, onRouteChange, storageKey]);
  const startNewGame = useCallback(() => {
    finishingRef.current = false;
    setSetupError(null);
    const source = getSecretWordPool();
    if (source.length === 0 && settings.dictionarySource !== 'custom') { setSetupError('Словарь ещё загружается. Попробуйте снова.'); return; }
    if (settings.dictionarySource === 'custom' && source.length === 0) { setSetupError('Мой словарь не загружен. Загрузите TXT/CSV-файл или выберите встроенный словарь.'); return; }
    const candidateLengths = settings.dictionarySource === 'custom' ? RANDOM_WORD_LENGTHS.filter(length => source.some(entry => entry.word.length === length)) : [settings.wordLength];
    if (candidateLengths.length === 0) { setSetupError('В вашем словаре нет слов длиной 4–6 букв.'); return; }
    const wordLength = candidateLengths[Math.floor(Math.random() * candidateLengths.length)];
    const pool = source.filter(entry => entry.word.length === wordLength);
    if (pool.length === 0) { setSetupError(settings.dictionarySource === 'custom' ? `В вашем словаре нет слов длиной ${wordLength}.` : `В словаре нет слов уровня ${settings.difficulty} длиной ${wordLength}.`); return; }
    const key = `wordle:${settings.dictionarySource}:${settings.difficulty}:${wordLength}`;
    const entry = getUnusedSessionWord(key, pool) || pool[Math.floor(Math.random() * pool.length)];
    setGameState({ ...createInitialGameState(), secretWord: entry.word, secretWordData: entry });
    setKeyStatuses({});
    onRouteChange('game');
    scrollTop();
  }, [getSecretWordPool, onRouteChange, settings]);

  const handleChar = useCallback((char: string) => { if (finishingRef.current) return; setGameState(prev => { const targetLength = getTargetWordLength(prev, settings.wordLength); return prev.gameStatus !== 'playing' || prev.currentGuess.length >= targetLength ? prev : { ...prev, currentGuess: prev.currentGuess + char, hint: null, error: null }; }); }, [settings.wordLength]);
  const handleDelete = useCallback(() => { if (finishingRef.current) return; setGameState(prev => prev.gameStatus !== 'playing' ? prev : { ...prev, currentGuess: prev.currentGuess.slice(0, -1), error: null }); }, []);
  const shake = useCallback(() => { setShakeRowIndex(gameState.rowIndex); window.setTimeout(() => setShakeRowIndex(null), 600); }, [gameState.rowIndex]);

  const handleEnter = useCallback(async () => {
    if (gameState.gameStatus !== 'playing' || finishingRef.current) return;
    const targetLength = getTargetWordLength(gameState, settings.wordLength);
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
    setGameState(prev => ({ ...prev, guesses, history: [...prev.history, { word, translation }], currentGuess: '', gameStatus: 'playing', rowIndex: prev.rowIndex + 1, hint: null, error: 'Сохраняем результат…' }));
    try { await onStatsUpdate(terminalStatus === 'won', gameState.secretWord); }
    catch (error) { console.error('Failed to save Classic result', error); }
    try { if (onDailyQuestResult) await onDailyQuestResult(terminalStatus === 'won', gameState.secretWord, guesses.length); }
    catch (error) { console.error('Failed to reconcile Classic daily quest', error); }
    finally {
      finishingRef.current = false;
      setGameState(prev => ({ ...prev, gameStatus: terminalStatus, error: null }));
    }
  }, [gameState, getValidationPool, getWordTranslation, onDailyQuestResult, onStatsUpdate, settings.wordLength, shake]);

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (route !== 'game' || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'Enter') void handleEnter(); else if (event.key === 'Backspace') handleDelete(); else { const char = event.key.toUpperCase(); if (/^[A-Z]$/.test(char)) handleChar(char); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [handleChar, handleDelete, handleEnter, route]);
  const fetchHint = useCallback(async () => { if (finishingRef.current || gameState.gameStatus !== 'playing' || gameState.loadingHint || (gameState.hintCoinsSpent || 0) >= COST) return; if (availableCoins < COST) { setGameState(prev => ({ ...prev, hint: 'Недостаточно монет для подсказки.' })); return; } const targetLength = getTargetWordLength(gameState, settings.wordLength); const pool = getModeWords().filter(word => word.length === targetLength), word = getBestEliminationHint(gameState.secretWord, gameState.guesses, pool); if (!word) { setGameState(prev => ({ ...prev, hint: 'Нет подходящих слов для подсказки.' })); return; } setGameState(prev => ({ ...prev, loadingHint: true })); const paid = onHintCharge ? await onHintCharge() : true; if (!paid) { setGameState(prev => ({ ...prev, hint: 'Недостаточно монет для подсказки.', loadingHint: false })); return; } const coinText = availableCoins === Number.MAX_SAFE_INTEGER ? '' : ' Списана 1 монета.'; window.setTimeout(() => setGameState(prev => ({ ...prev, hint: `Попробуйте слово: ${word}.${coinText}`, loadingHint: false, hintCoinsSpent: COST })), 350); }, [availableCoins, gameState, getModeWords, onHintCharge, settings.wordLength]);
  return { setupError, gameState, keyStatuses, shakeRowIndex, hasActiveGame, resumeGame, startNewGame, handleChar, handleDelete, handleEnter, fetchHint };
};
