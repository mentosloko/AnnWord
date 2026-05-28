import { supabase } from '../supabase';
import { GameRewardType, ViewState } from '../types';

const ANALYTICS_SESSION_KEY = 'annword_analytics_session_id';
const ANALYTICS_QUEUE_KEY = 'annword_analytics_queue_v1';
const FLUSH_DELAY_MS = 3000;
const MAX_BATCH_SIZE = 25;
const MAX_STORED_EVENTS = 200;

export type AnalyticsEventType = 'game' | 'reward' | 'economy' | 'inventory' | 'character' | 'dictionary' | 'auth' | 'navigation';

export type AnalyticsEventName =
  | 'game_started'
  | 'game_finished'
  | 'hint_used'
  | 'reward_granted'
  | 'shop_item_bought'
  | 'inventory_item_used'
  | 'character_selected'
  | 'dictionary_uploaded'
  | 'route_changed'
  | 'login_success'
  | 'logout';

export type AnalyticsPayload = Record<string, unknown>;

interface TrackEventInput {
  userId?: string | null;
  eventType: AnalyticsEventType;
  eventName: AnalyticsEventName;
  gameType?: GameRewardType | null;
  route?: ViewState | string | null;
  payload?: AnalyticsPayload;
}

export interface QueuedAnalyticsEvent {
  user_id: string | null;
  session_id: string | null;
  event_type: AnalyticsEventType;
  event_name: AnalyticsEventName;
  game_type: GameRewardType | null;
  route: ViewState | string | null;
  occurred_at: string;
  payload: AnalyticsPayload;
  app_version: string | null;
  user_agent: string | null;
  device_type: string | null;
}

let queue: QueuedAnalyticsEvent[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readQueue = (): QueuedAnalyticsEvent[] => {
  if (queue) return queue;
  if (!isBrowser()) {
    queue = [];
    return queue;
  }

  try {
    const raw = window.localStorage.getItem(ANALYTICS_QUEUE_KEY);
    queue = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queue)) queue = [];
  } catch {
    queue = [];
  }
  return queue;
};

const persistQueue = (): void => {
  if (!isBrowser()) return;
  try {
    const safeQueue = readQueue().slice(-MAX_STORED_EVENTS);
    queue = safeQueue;
    window.localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(safeQueue));
  } catch {
    // Analytics must never break the app.
  }
};

export const getAnalyticsSessionId = (): string | null => {
  if (!isBrowser()) return null;

  try {
    const existing = window.localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) return existing;

    const next = crypto.randomUUID();
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, next);
    return next;
  } catch {
    return null;
  }
};

const getDeviceType = (): string | null => {
  if (!isBrowser()) return null;
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (/tablet|ipad/.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android/.test(userAgent)) return 'mobile';
  return 'desktop';
};

const getAppVersion = (): string | null => {
  try {
    return ((import.meta as any).env || {}).VITE_APP_VERSION || null;
  } catch {
    return null;
  }
};

export const createAnalyticsEvent = ({ userId, eventType, eventName, gameType = null, route = null, payload = {} }: TrackEventInput): QueuedAnalyticsEvent => ({
  user_id: userId || null,
  session_id: getAnalyticsSessionId(),
  event_type: eventType,
  event_name: eventName,
  game_type: gameType,
  route,
  occurred_at: new Date().toISOString(),
  payload,
  app_version: getAppVersion(),
  user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  device_type: getDeviceType(),
});

const sendEvents = async (events: QueuedAnalyticsEvent[]): Promise<void> => {
  if (events.length === 0) return;
  const { error } = await supabase.rpc('record_analytics_events', { p_events: events });
  if (error) throw error;
};

const scheduleFlush = (): void => {
  if (flushTimer || !isBrowser()) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void analyticsService.flush();
  }, FLUSH_DELAY_MS);
};

export const analyticsService = {
  createEvent: createAnalyticsEvent,

  trackEvent: (input: TrackEventInput): void => {
    try {
      readQueue().push(createAnalyticsEvent(input));
      persistQueue();
      scheduleFlush();
    } catch (error) {
      console.error('Analytics enqueue failed', error);
    }
  },

  flush: async (): Promise<void> => {
    if (isFlushing) return;
    const currentQueue = readQueue();
    if (currentQueue.length === 0) return;

    isFlushing = true;
    const batch = currentQueue.splice(0, MAX_BATCH_SIZE);
    persistQueue();

    try {
      await sendEvents(batch);
    } catch (error) {
      queue = [...batch, ...readQueue()].slice(-MAX_STORED_EVENTS);
      persistQueue();
      console.error('Analytics flush failed', error);
    } finally {
      isFlushing = false;
      if (readQueue().length > 0) scheduleFlush();
    }
  },

  sendNow: async (events: QueuedAnalyticsEvent[]): Promise<void> => {
    try {
      await sendEvents(events);
    } catch (error) {
      queue = [...events, ...readQueue()].slice(-MAX_STORED_EVENTS);
      persistQueue();
      console.error('Analytics immediate send failed', error);
    }
  },
};

if (isBrowser()) {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void analyticsService.flush();
  });
  window.addEventListener('beforeunload', () => {
    void analyticsService.flush();
  });
}