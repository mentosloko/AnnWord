import { supabase } from '../supabase';
import { GameRewardType, ViewState } from '../types';

const ANALYTICS_SESSION_KEY = 'annword_analytics_session_id';

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

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

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
    return import.meta.env.VITE_APP_VERSION || null;
  } catch {
    return null;
  }
};

export const analyticsService = {
  trackEvent: async ({ userId, eventType, eventName, gameType = null, route = null, payload = {} }: TrackEventInput): Promise<void> => {
    try {
      const sessionId = getAnalyticsSessionId();
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

      const { error } = await supabase.from('analytics_events').insert({
        user_id: userId || null,
        session_id: sessionId,
        event_type: eventType,
        event_name: eventName,
        game_type: gameType,
        route,
        payload,
        app_version: getAppVersion(),
        user_agent: userAgent,
        device_type: getDeviceType(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Analytics event failed', error);
    }
  },
};