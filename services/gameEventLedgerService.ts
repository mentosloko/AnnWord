import { supabase } from '../supabase';
import { GameRewardInput } from './gamificationRules';
import { QueuedAnalyticsEvent } from './analyticsService';
import { WordPracticeResult } from './gameSessionEngine';

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
      coinsDelta: reward.coins,
      xpDelta: reward.xp,
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
    const { error } = await supabase.rpc('record_game_events', { p_events: safeEvents });
    if (error) throw error;
  },
};