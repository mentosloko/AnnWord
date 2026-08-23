import type { GameRewardInput } from './gamificationRules';
import type { QueuedAnalyticsEvent } from './analyticsService';
import type { WordPracticeResult } from './gameSessionEngine';
import { backendApiRequest } from './backendApiClient';

export type GameLedgerEventType = 'game_started' | 'game_finished' | 'word_failed' | 'word_mastered' | 'reward_granted';

export interface GameLedgerEvent {
  userId: string;
  eventKey: string;
  eventType: GameLedgerEventType;
  gameMode?: string | null;
  word?: string | null;
  result?: string | null;
  questDate?: string | null;
  questKind?: string | null;
  coinsDelta?: number;
  xpDelta?: number;
  payload?: Record<string, unknown>;
  occurredAt: string;
}

export interface WordLedgerContext {
  gameMode: string;
  wordLength?: number | 'any';
  dictionarySource?: string;
  difficulty?: string;
  route?: string;
  attempt?: number;
}

const randomId = (): string => {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};
const normalizeWord = (word: string): string => word.trim().toUpperCase();
const modeFromReward = (input: GameRewardInput): string => input.type;

const EVENT_BATCH_SIZE = 100;
const EVENT_FLUSH_DELAY_MS = 400;
let queuedEvents: GameLedgerEvent[] = [];
let flushTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;

const flushQueuedEvents = async (): Promise<void> => {
  if (flushPromise) return flushPromise;
  if (flushTimer) {
    globalThis.clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushPromise = (async () => {
    while (queuedEvents.length) {
      const batch = queuedEvents.splice(0, EVENT_BATCH_SIZE);
      try {
        await backendApiRequest('/api/game-events/events', {
          method: 'POST',
          body: { events: batch },
        });
      } catch (error) {
        queuedEvents = [...batch, ...queuedEvents];
        throw error;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
};

const scheduleEventFlush = (): Promise<void> => {
  if (queuedEvents.length >= 20) return flushQueuedEvents();
  if (!flushTimer) {
    flushTimer = globalThis.setTimeout(() => {
      flushTimer = null;
      void flushQueuedEvents().catch(error => console.error('Failed to flush game event batch', error));
    }, EVENT_FLUSH_DELAY_MS);
  }
  return Promise.resolve();
};

export const gameEventLedgerService = {
  createWordPracticeEvent(userId: string, word: string, result: WordPracticeResult, context: WordLedgerContext): GameLedgerEvent | null {
    const normalizedWord = normalizeWord(word);
    if (!userId || !normalizedWord) return null;
    const occurredAt = new Date().toISOString();
    const eventType: GameLedgerEventType = result === 'mastered' ? 'word_mastered' : 'word_failed';
    return {
      userId,
      eventKey: `word:${userId}:${context.gameMode}:${normalizedWord}:${eventType}:${occurredAt}:${randomId()}`,
      eventType,
      gameMode: context.gameMode,
      word: normalizedWord,
      result,
      coinsDelta: 0,
      xpDelta: 0,
      payload: { source: 'word_practice_v1', ...context },
      occurredAt,
    };
  },

  createRewardEvents(userId: string, input: GameRewardInput, analyticsEvents: QueuedAnalyticsEvent[], reward: { xp: number; coins: number; label: string }): GameLedgerEvent[] {
    const occurredAt = new Date().toISOString();
    const basePayload: Record<string, unknown> = { input, label: reward.label, source: 'client_aggregate_v1' };
    const finishedEvent: GameLedgerEvent = {
      userId,
      eventKey: `finish:${userId}:${modeFromReward(input)}:${occurredAt}:${randomId()}`,
      eventType: 'game_finished',
      gameMode: modeFromReward(input),
      result: 'completed',
      coinsDelta: 0,
      xpDelta: 0,
      payload: basePayload,
      occurredAt,
    };
    const rewardEvent: GameLedgerEvent = {
      userId,
      eventKey: `reward:${userId}:${modeFromReward(input)}:${occurredAt}:${randomId()}`,
      eventType: 'reward_granted',
      gameMode: modeFromReward(input),
      result: reward.coins || reward.xp ? 'granted' : 'none',
      coinsDelta: reward.coins,
      xpDelta: reward.xp,
      payload: { ...basePayload, analyticsEvents: analyticsEvents.map(event => ({ eventName: event.event_name, gameType: event.game_type, occurredAt: event.occurred_at })) },
      occurredAt,
    };
    return [finishedEvent, rewardEvent];
  },

  async sendNow(events: Array<GameLedgerEvent | null | undefined>): Promise<void> {
    const safeEvents = events.filter((event): event is GameLedgerEvent => Boolean(event));
    if (!safeEvents.length) return;
    queuedEvents.push(...safeEvents);
    await scheduleEventFlush();
  },

  async flush(): Promise<void> {
    await flushQueuedEvents();
  },
};
