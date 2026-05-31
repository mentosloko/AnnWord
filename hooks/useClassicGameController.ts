import { useCallback, useEffect, useState } from 'react';
import { MAX_GUESSES } from '../constants';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { getBestEliminationHint } from '../services/hintService';
import { getUnusedSessionWord } from '../services/sessionWordHistory';
import { CharStatus, EnrichedWord, GameSettings, GameState, ViewState } from '../types';

interface Args {
  route: ViewState;
  settings: GameSettings;
  sessionOwnerId?: string | null;
  getSecretWordPool: () => EnrichedWord[];
  getValidationPool: () => string[];
  getModeWords: () => string[];
  onRouteChange: (route: ViewState) => void;
  onStatsUpdate: (won: boolean, word: string, attempts: number, coinsAdjustment?: number) => Promise<void>;
  availableCoins?: number;
  onHintCharge?: () => Promise<boolean>;
}
const COST = 1;
const activeGameKey = (owner?: string | null) => `annword:active-wordle-session:v1:${owner || 'guest'}`;
const scrollTop = () => { if (typeof window === 'undefined' || typeof document === 'undefined') return; document.documentElement.scrollTop = 0; document.body.scrollTop = 0; try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch { /* no-op */ } };
export const createInitialGameState = (): GameState => ({ secretWord: '', secretWordData: null, guesses: [], history: [], currentGuess: '', gameStatus: 'playing', rowIndex: 0, hint: null, loadingHint: false, hintCoinsSpent: 0, error: null });
const loadActiveGame = (key: string): { gameState: GameState; keyStatuses: Record<string, CharStatus> } | null => {
  if (typeof window === 'undefined') return null;
  try { const raw = window.localStorage.getItem(key); if (!raw) return null; const parsed = JSON.parse(raw); if (!parsed?.gameState?.secretWord || parsed.gameState.gameStatus !== 'playing') return null; return { gameState: { ...createInitialGameState(), ...parsed.gameState, loadingHint: false, error: null }, keyStatuses: parsed.keyStatuses && typeof parsed.keyStatuses === 'object' ? parsed.keyStatuses : {} }; } catch { return null; }
};
export const getGuessLetterStatuses = (guess: string, secretWord: string): CharStatus[] => { const status: CharStatus[] = Array(guess.length).fill('absent'), secret = secretWord.split(''); guess.split('').forEach((char, i) => { if (char === secret[i]) { status[i] = 'correct'; secret[i] = '#'; } }); guess.split('').forEach((char, i) => { if (status[i] === 'correct') return; const found = secret.indexOf(char); if (found >= 0) { status[i] = 'present'; secret[found] = '#'; } }); return status; };
export const getUpdatedKeyStatuses = (previous: Record<string, CharStatus>, guess: string, secretWord: string) => { const next = { ...previous }, rows = getGuessLetterStatuses(guess, secretWord); guess.split('').forEach((char, i) => { if (rows[i] === 'correct') next[char] = 'correct'; else if (rows[i] === 'present' && next[char] !== 'correct') next[char] = 'present'; else if (!next[char]) next[char] = 'absent'; }); return next; };
export const useClassicGameController = ({ route, settings, sessionOwnerId, getSecretWordPool, getValidationPool, getModeWords, onRouteChange, onStatsUpdate, availableCoins = Number.POSITIVE_INFINITY, onHintCharge }: Args) => {
  const storageKey = activeGameKey(sessionOwnerId);
  const restored = loadActiveGame(storageKey);
  const [setupError, setSetupError] = useState<string | null>(null), [gameState, setGameState] = useState<GameState>(restored?.gameState ?? createInitialGameState), [keyStatuses, setKeyStatuses] = useState<Record<string, CharStatus>>(restored?.keyStatuses ?? {}), [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);
  useEffect(() => setSetupError(null), [settings]);
  useEffect(() => { const saved = loadActiveGame(storageKey); setGameState(saved?.gameState ?? createInitialGameState()); setKeyStatuses(saved?.keyStatuses ?? {}); }, [storageKey]);
  useEffect(() => { if (route === 'game') scrollTop(); }, [route, gameState.secretWord]);
  useEffect(() => { if (typeof window === 'undefined') return; if (gameState.secretWord && gameState.gameStatus === 'playing') window.localStorage.setItem(storageKey, JSON.stringify({ gameState: { ...gameState, loadingHint: false, error: null }, keyStatuses })); else window.localStorage.removeItem(storageKey); }, [gameState, keyStatuses, storageKey]);
  const hasActiveGame = Boolean(gameState.secretWord && gameState.gameStatus === 'playing');
  const resumeGame = useCallback(() => { if (!gameState.secretWord || gameState.gameStatus !== 'playing') return false; onRouteChange('game'); scrollTop(); return true; }, [gameState.gameStatus, gameState.secretWord, onRouteChange]);
  const startNewGame = useCallback(() => { setSetupError(null); const source = getSecretWordPool(); if (settings.dictionarySource === 'custom' && source.length === 0) { setSetupError('Мой словарь не загружен. Загрузите TXT/CSV-файл или выберите встроенный словарь.'); return; } const pool = source.filter(entry => entry.word.length === settings.wordLength); if (pool.length === 0) { setSetupError(settings.dictionarySource === 'custom' ? `В вашем словаре нет слов длиной ${settings.wordLength}.` : `В словаре нет слов уровня ${settings.difficulty} длиной ${settings.wordLength}.`); return; } const key = `wordle:${settings.dictionarySource}:${settings.difficulty}:${settings.wordLength}`, entry = getUnusedSessionWord(key, pool) || pool[Math.floor(Math.random() * pool.length)]; setGameState({ ...createInitialGameState(), secretWord: entry.word, secretWordData: entry }); setKeyStatuses({}); onRouteChange('game'); scrollTop(); }, [getSecretWordPool, onRouteChange, settings]);
  const handleChar = useCallback((char: string) => setGameState(prev => prev.gameStatus !== 'playing' || prev.currentGuess.length >= settings.wordLength ? prev : { ...prev, currentGuess: prev.currentGuess + char, hint: null, error: null }), [settings.wordLength]);
  const handleDelete = useCallback(() => setGameState(prev => prev.gameStatus !== 'playing' ? prev : { ...prev, currentGuess: prev.currentGuess.slice(0, -1), error: null }), []);
  const shake = useCallback(() => { setShakeRowIndex(gameState.rowIndex); window.setTimeout(() => setShakeRowIndex(null), 600); }, [gameState.rowIndex]);
  const handleEnter = useCallback(async () => { if (gameState.gameStatus !== 'playing') return; if (gameState.currentGuess.length !== settings.wordLength) { setGameState(prev => ({ ...prev, error: 'Недостаточно букв' })); shake(); return; } if (!getValidationPool().includes(gameState.currentGuess)) { setGameState(prev => ({ ...prev, error: 'Такого слова нет в словаре' })); shake(); return; } const word = gameState.currentGuess, entry = COMMON_WORDS_EN.find(item => item.word.toUpperCase() === word), guesses = [...gameState.guesses, word], status: GameState['gameStatus'] = word === gameState.secretWord ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing'; setKeyStatuses(prev => getUpdatedKeyStatuses(prev, word, gameState.secretWord)); setGameState(prev => ({ ...prev, guesses, history: [...prev.history, { word, translation: entry?.translation || null }], currentGuess: '', gameStatus: status, rowIndex: prev.rowIndex + 1, hint: null, error: null })); if (status !== 'playing') await onStatsUpdate(status === 'won', gameState.secretWord, guesses.length); }, [gameState, getValidationPool, onStatsUpdate, settings.wordLength, shake]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (route !== 'game' || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'Enter') void handleEnter(); else if (event.key === 'Backspace') handleDelete(); else { const char = event.key.toUpperCase(); if (/^[A-Z]$/.test(char)) handleChar(char); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [handleChar, handleDelete, handleEnter, route]);
  const fetchHint = useCallback(async () => { if (gameState.gameStatus !== 'playing' || gameState.loadingHint || (gameState.hintCoinsSpent || 0) >= COST) return; if (availableCoins < COST) { setGameState(prev => ({ ...prev, hint: 'Недостаточно ₽ для подсказки.' })); return; } const pool = getModeWords().filter(word => word.length === settings.wordLength), word = getBestEliminationHint(gameState.secretWord, gameState.guesses, pool); if (!word) { setGameState(prev => ({ ...prev, hint: 'Нет подходящих слов для подсказки.' })); return; } setGameState(prev => ({ ...prev, loadingHint: true })); const paid = onHintCharge ? await onHintCharge() : true; if (!paid) { setGameState(prev => ({ ...prev, hint: 'Недостаточно ₽ для подсказки.', loadingHint: false })); return; } window.setTimeout(() => setGameState(prev => ({ ...prev, hint: `Попробуйте слово: ${word}. Списано: −${COST} ₽`, loadingHint: false, hintCoinsSpent: COST })), 350); }, [availableCoins, gameState, getModeWords, onHintCharge, settings.wordLength]);
  return { setupError, gameState, keyStatuses, shakeRowIndex, hasActiveGame, resumeGame, startNewGame, handleChar, handleDelete, handleEnter, fetchHint };
};
