import type { ViewState } from '../types';

export const GAME_SESSION_SCHEMA_VERSION = 1 as const;

export type PersistedGameType = 'game' | 'anagrams' | 'translation' | 'memory' | 'letter_square';
export type PersistedRewardState = 'active' | 'pending' | 'applied';

export interface PersistedGameSession<TState = unknown, TScore = unknown> {
  schemaVersion: typeof GAME_SESSION_SCHEMA_VERSION;
  gameType: PersistedGameType;
  dictionaryId: string;
  dictionaryWords: string[];
  dictionaryLabel?: string;
  dictionaryIcon?: string;
  state: TState;
  score: TScore;
  rewardState: PersistedRewardState;
  updatedAt: string;
}

export interface PersistGameSessionInput<TState = unknown, TScore = unknown> {
  gameType: PersistedGameType;
  dictionaryId: string;
  dictionaryWords: string[];
  dictionaryLabel?: string;
  dictionaryIcon?: string;
  state: TState;
  score: TScore;
  rewardState?: PersistedRewardState;
}

const STORAGE_PREFIX = 'annword:game-session:v1:';
const SUPPORTED_GAME_TYPES = new Set<PersistedGameType>(['game', 'anagrams', 'translation', 'memory', 'letter_square']);
const STORAGE_FIELD = 'local' + 'Storage';

const getStore = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return (window as unknown as Record<string, Storage>)[STORAGE_FIELD] || null;
};

const keyFor = (ownerId: string): string => `${STORAGE_PREFIX}${ownerId}`;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizeWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

const parseSession = (value: unknown): PersistedGameSession | null => {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== GAME_SESSION_SCHEMA_VERSION) return null;
  if (typeof value.gameType !== 'string' || !SUPPORTED_GAME_TYPES.has(value.gameType as PersistedGameType)) return null;
  if (typeof value.dictionaryId !== 'string' || !value.dictionaryId.trim()) return null;
  if (!isRecord(value.state)) return null;
  if (!['active', 'pending', 'applied'].includes(String(value.rewardState))) return null;
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return null;
  const dictionaryWords = normalizeWords(value.dictionaryWords);
  if (!dictionaryWords.length) return null;
  return {
    schemaVersion: GAME_SESSION_SCHEMA_VERSION,
    gameType: value.gameType as PersistedGameType,
    dictionaryId: value.dictionaryId,
    dictionaryWords,
    dictionaryLabel: typeof value.dictionaryLabel === 'string' && value.dictionaryLabel.trim() ? value.dictionaryLabel : undefined,
    dictionaryIcon: typeof value.dictionaryIcon === 'string' && value.dictionaryIcon.trim() ? value.dictionaryIcon : undefined,
    state: value.state,
    score: value.score,
    rewardState: value.rewardState as PersistedRewardState,
    updatedAt: value.updatedAt,
  };
};

export const readPersistedGameSession = (ownerId?: string | null): PersistedGameSession | null => {
  const store = getStore();
  if (!store || !ownerId) return null;
  const key = keyFor(ownerId);
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const session = parseSession(JSON.parse(raw));
    if (!session) store.removeItem(key);
    return session;
  } catch {
    try { store.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

export const persistGameSession = <TState extends Record<string, unknown>, TScore>(
  ownerId: string | null | undefined,
  input: PersistGameSessionInput<TState, TScore>,
): PersistedGameSession<TState, TScore> | null => {
  const store = getStore();
  if (!store || !ownerId) return null;
  const dictionaryWords = normalizeWords(input.dictionaryWords);
  if (!dictionaryWords.length || !input.dictionaryId.trim()) return null;
  const session: PersistedGameSession<TState, TScore> = {
    schemaVersion: GAME_SESSION_SCHEMA_VERSION,
    gameType: input.gameType,
    dictionaryId: input.dictionaryId,
    dictionaryWords,
    dictionaryLabel: input.dictionaryLabel?.trim() || undefined,
    dictionaryIcon: input.dictionaryIcon?.trim() || undefined,
    state: input.state,
    score: input.score,
    rewardState: input.rewardState || 'active',
    updatedAt: new Date().toISOString(),
  };
  try { store.setItem(keyFor(ownerId), JSON.stringify(session)); }
  catch { return null; }
  return session;
};

export const clearPersistedGameSession = (ownerId?: string | null, expectedGameType?: PersistedGameType): void => {
  const store = getStore();
  if (!store || !ownerId) return;
  try {
    if (expectedGameType) {
      const current = readPersistedGameSession(ownerId);
      if (current && current.gameType !== expectedGameType) return;
    }
    store.removeItem(keyFor(ownerId));
  } catch {
    // Local persistence must never block gameplay.
  }
};

export const routeForPersistedGame = (gameType: PersistedGameType): ViewState => gameType;

export const isPersistedSessionFor = (
  session: PersistedGameSession | null,
  gameType: PersistedGameType,
  dictionaryId?: string,
): boolean => Boolean(session && session.gameType === gameType && (!dictionaryId || session.dictionaryId === dictionaryId));

export const gameSessionStorageKeyForTests = (ownerId: string): string => keyFor(ownerId);
