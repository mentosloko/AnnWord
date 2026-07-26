import { query } from './db';

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value.slice(0, 500) : fallback;
const nullableText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.slice(0, 500) : null;
const numberValue = (value: unknown): number => Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
const dateValue = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : '';
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const questDate = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export async function insertAnalyticsEvents(userId: string | null, raw: unknown, limit = 50): Promise<number> {
  const rawEvents = Array.isArray(raw) ? raw : [];
  const events = rawEvents.filter(isObject).slice(0, limit);
  if (!events.length) return 0;

  const values: unknown[] = [];
  const placeholders = events.map((event, index) => {
    const offset = index * 10;
    values.push(
      userId,
      nullableText(event.session_id ?? event.sessionId),
      text(event.event_type ?? event.eventType, 'unknown'),
      text(event.event_name ?? event.eventName, 'unknown'),
      nullableText(event.game_type ?? event.gameType),
      nullableText(event.route),
      dateValue(event.occurred_at ?? event.occurredAt),
      JSON.stringify(isObject(event.payload) ? event.payload : {}),
      nullableText(event.app_version ?? event.appVersion),
      nullableText(event.device_type ?? event.deviceType),
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}::jsonb, $${offset + 9}, $${offset + 10})`;
  });

  await query(
    `insert into analytics_events (user_id, session_id, event_type, event_name, game_type, route, occurred_at, payload, app_version, device_type)
     values ${placeholders.join(', ')}`,
    values,
  );
  return events.length;
}

export async function insertGameEvents(userId: string, raw: unknown, limit = 100): Promise<number> {
  const rawEvents = Array.isArray(raw) ? raw : [];
  const events = rawEvents.filter(isObject).slice(0, limit);
  if (!events.length) return 0;

  const values: unknown[] = [];
  const placeholders = events.map((event, index) => {
    const offset = index * 11;
    values.push(
      userId,
      text(event.eventKey ?? event.event_key, `${userId}:${Date.now()}:${index}`),
      text(event.eventType ?? event.event_type, 'unknown'),
      nullableText(event.gameMode ?? event.game_mode),
      nullableText(event.word),
      nullableText(event.result),
      questDate(event.questDate ?? event.quest_date),
      nullableText(event.questKind ?? event.quest_kind),
      numberValue(event.coinsDelta ?? event.coins_delta),
      numberValue(event.xpDelta ?? event.xp_delta),
      JSON.stringify(isObject(event.payload) ? event.payload : {}),
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}::jsonb, now())`;
  });

  await query(
    `insert into game_events (user_id, event_key, event_type, game_mode, word, result, quest_date, quest_kind, coins_delta, xp_delta, payload, occurred_at)
     values ${placeholders.join(', ')}
     on conflict (event_key) do nothing`,
    values,
  );
  return events.length;
}
