import { supabase } from '../supabase';

export interface AdminDailyGameStat {
  day: string;
  game_type: string | null;
  games_started: number;
  games_finished: number;
  games_won: number;
  unique_users: number;
}

export interface AdminEconomyStat {
  day: string;
  coins_earned: number;
  coins_spent: number;
  purchases: number;
  items_used: number;
}

export interface AdminEventSummary {
  event_type: string;
  event_name: string;
  count: number;
}

export interface AdminAnalyticsSnapshot {
  gameStats: AdminDailyGameStat[];
  economyStats: AdminEconomyStat[];
  eventSummary: AdminEventSummary[];
}

const parseNumber = (value: unknown): number => Number(value || 0);

export const adminAnalyticsService = {
  loadSnapshot: async (): Promise<AdminAnalyticsSnapshot> => {
    const [gameStatsResult, economyStatsResult, eventSummaryResult] = await Promise.all([
      supabase
        .from('admin_daily_game_stats')
        .select('*')
        .order('day', { ascending: false })
        .limit(30),
      supabase
        .from('admin_economy_stats')
        .select('*')
        .order('day', { ascending: false })
        .limit(30),
      supabase
        .from('analytics_events')
        .select('event_type,event_name')
        .order('occurred_at', { ascending: false })
        .limit(1000),
    ]);

    if (gameStatsResult.error) throw gameStatsResult.error;
    if (economyStatsResult.error) throw economyStatsResult.error;
    if (eventSummaryResult.error) throw eventSummaryResult.error;

    const summaryMap = new Map<string, AdminEventSummary>();
    for (const event of eventSummaryResult.data || []) {
      const key = `${event.event_type}:${event.event_name}`;
      const current = summaryMap.get(key) || {
        event_type: event.event_type,
        event_name: event.event_name,
        count: 0,
      };
      current.count += 1;
      summaryMap.set(key, current);
    }

    return {
      gameStats: (gameStatsResult.data || []).map(row => ({
        day: row.day,
        game_type: row.game_type,
        games_started: parseNumber(row.games_started),
        games_finished: parseNumber(row.games_finished),
        games_won: parseNumber(row.games_won),
        unique_users: parseNumber(row.unique_users),
      })),
      economyStats: (economyStatsResult.data || []).map(row => ({
        day: row.day,
        coins_earned: parseNumber(row.coins_earned),
        coins_spent: parseNumber(row.coins_spent),
        purchases: parseNumber(row.purchases),
        items_used: parseNumber(row.items_used),
      })),
      eventSummary: Array.from(summaryMap.values()).sort((a, b) => b.count - a.count),
    };
  },
};