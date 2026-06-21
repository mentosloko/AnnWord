import { DictionarySource, WordLength } from '../types';

export type SavedGameMode = 'classic' | 'anagrams' | 'translation' | 'sprint' | 'memory' | 'hangman' | 'letter_square';
export type SavedGameStatus = 'playing' | 'finished' | 'abandoned';

export interface SavedGameSessionMeta {
  mode: SavedGameMode;
  wordLength?: WordLength | 'any';
  dictionarySource?: DictionarySource;
  difficulty?: string;
  questId?: string | null;
  startedAt: string;
  updatedAt: string;
  status: SavedGameStatus;
}

const keyFor = (ownerId: string) => `annword:saved-game-session-meta:v1:${ownerId || 'guest'}`;

const storage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
};

export const savedGameSessionService = {
  read(ownerId: string): SavedGameSessionMeta | null {
    const store = storage();
    if (!store) return null;
    try {
      const raw = store.getItem(keyFor(ownerId));
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.mode && parsed?.status ? parsed as SavedGameSessionMeta : null;
    } catch {
      return null;
    }
  },
  write(ownerId: string, input: Omit<SavedGameSessionMeta, 'startedAt' | 'updatedAt'> & { startedAt?: string }): void {
    const store = storage();
    if (!store) return;
    const previous = this.read(ownerId);
    const now = new Date().toISOString();
    const next: SavedGameSessionMeta = {
      ...input,
      startedAt: input.startedAt || previous?.startedAt || now,
      updatedAt: now,
    };
    try { store.setItem(keyFor(ownerId), JSON.stringify(next)); } catch { /* ignore */ }
  },
  clear(ownerId: string): void {
    const store = storage();
    if (!store) return;
    try { store.removeItem(keyFor(ownerId)); } catch { /* ignore */ }
  },
};