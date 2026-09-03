import type { UserProfile } from '../types';
import { backendApiRequest } from './backendApiClient';
import { dailyQuestService, type DailyQuestGameResult } from './dailyQuestService';

export interface ClassicResultPayload {
  operationId: string;
  word: string;
  won: boolean;
  coinsAdjustment: number;
}

export type ClassicResultCommitResponse = DailyQuestGameResult & {
  duplicate: boolean;
};

type StoredClassicResult = ClassicResultPayload & {
  queuedAt: string;
};

type ProfileListener = (profile: UserProfile) => void;

const STORAGE_PREFIX = 'annword:classic-result-outbox:v1:';
const MAX_PENDING_RESULTS = 30;
const MAX_COMPLETED_RESULTS = 50;
const completedResults = new Map<string, ClassicResultCommitResponse>();
const flushLocks = new Map<string, Promise<void>>();
const profileListeners = new Map<string, Set<ProfileListener>>();
let activeUserId: string | null = null;
let listenersInstalled = false;

const storageKey = (userId: string): string => `${STORAGE_PREFIX}${userId}`;
const canUseStorage = (): boolean => typeof window !== 'undefined' && Boolean(window.localStorage);

const readQueue = (userId: string): StoredClassicResult[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.operationId === 'string') : [];
  } catch {
    return [];
  }
};

const writeQueue = (userId: string, queue: StoredClassicResult[]): void => {
  if (!canUseStorage()) return;
  try {
    const safe = queue.slice(-MAX_PENDING_RESULTS);
    if (safe.length === 0) window.localStorage.removeItem(storageKey(userId));
    else window.localStorage.setItem(storageKey(userId), JSON.stringify(safe));
  } catch {
    // A storage failure must not block the game result screen.
  }
};

const rememberCompleted = (operationId: string, result: ClassicResultCommitResponse): void => {
  completedResults.set(operationId, result);
  while (completedResults.size > MAX_COMPLETED_RESULTS) {
    const oldest = completedResults.keys().next().value as string | undefined;
    if (!oldest) break;
    completedResults.delete(oldest);
  }
};

const notifyProfile = (userId: string, profile: UserProfile | null): void => {
  if (!profile) return;
  for (const listener of profileListeners.get(userId) || []) {
    try { listener(profile); } catch (error) { console.error('Classic result profile listener failed', error); }
  }
};

const sendResult = async (entry: StoredClassicResult): Promise<ClassicResultCommitResponse> => {
  return backendApiRequest<ClassicResultCommitResponse>('/api/daily-quest/classic-result', {
    method: 'POST',
    body: {
      operationId: entry.operationId,
      word: entry.word,
      won: entry.won,
      coinsAdjustment: entry.coinsAdjustment,
    },
  });
};

const flushUser = async (userId: string): Promise<void> => {
  const existing = flushLocks.get(userId);
  if (existing) return existing;

  const task = (async () => {
    while (true) {
      const queue = readQueue(userId);
      const entry = queue[0];
      if (!entry) return;
      try {
        const result = await sendResult(entry);
        dailyQuestService.primeTodayQuest(result.quest);
        rememberCompleted(entry.operationId, result);
        notifyProfile(userId, result.profile);
        writeQueue(userId, queue.slice(1));
      } catch (error) {
        console.warn('Classic result queued for retry', {
          operationId: entry.operationId,
          reason: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
  })().finally(() => {
    flushLocks.delete(userId);
  });

  flushLocks.set(userId, task);
  return task;
};

const createOperationId = (): string => {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

const installRetryListeners = (): void => {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  const retry = () => { if (activeUserId) void flushUser(activeUserId); };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
};

export const classicResultOutboxService = {
  setActiveUser(userId: string | null): void {
    activeUserId = userId;
    installRetryListeners();
    if (userId) void flushUser(userId);
  },

  subscribe(userId: string, listener: ProfileListener): () => void {
    const listeners = profileListeners.get(userId) || new Set<ProfileListener>();
    listeners.add(listener);
    profileListeners.set(userId, listeners);
    return () => {
      const current = profileListeners.get(userId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) profileListeners.delete(userId);
    };
  },

  commit(userId: string, input: Omit<ClassicResultPayload, 'operationId'> & { operationId?: string }): Promise<ClassicResultCommitResponse | null> {
    const operationId = input.operationId || createOperationId();
    const queue = readQueue(userId);
    if (!queue.some(entry => entry.operationId === operationId)) {
      queue.push({
        operationId,
        word: input.word.trim().toUpperCase(),
        won: input.won === true,
        coinsAdjustment: Math.round(input.coinsAdjustment || 0),
        queuedAt: new Date().toISOString(),
      });
      writeQueue(userId, queue);
    }

    const commitPromise = (async () => {
      await flushUser(userId);
      const result = completedResults.get(operationId) || null;
      completedResults.delete(operationId);
      return result;
    })();
    dailyQuestService.registerClassicResultCommit(commitPromise);
    return commitPromise;
  },

  flush(userId: string): Promise<void> {
    return flushUser(userId);
  },
};
