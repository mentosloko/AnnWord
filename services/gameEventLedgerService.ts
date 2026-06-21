import { GameRewardInput } from './gamificationRules';
import { QueuedAnalyticsEvent } from './analyticsService';

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

const randomId = (): string => {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

const modeFromReward = (input: GameRewardInput): string => input.type;

export const gameEventLedgerService = {
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
};