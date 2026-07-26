import { supabase } from '../supabase';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { normalizeCustomDictionary, normalizeWord } from './dictionaryEngine';
import { backendApiBaseUrl, backendApiRequest, isBackendApiConfigured, readBackendAccessToken } from './backendApiClient';

export interface AdminDailyGameStat {
  day: string;
  game_type: string | null;
  games_started: number;
  games_finished: number;
  games_won: number;
  unique_users: number;
}
export interface AdminEconomyStat { day: string; coins_earned: number; coins_spent: number; purchases: number; items_used: number; }
export interface AdminEconomyOverview { total_coins: number; users_with_coins: number; kids_accounts: number; }
export interface AdminEventSummary { event_type: string; event_name: string; count: number; }
export interface AdminUnsupportedDictionaryRow { userId: string; username: string; words: string[]; }
export interface AdminLoadingPerformanceRow { path: string; requests: number; errors: number; avg_duration_ms: number; p95_duration_ms: number; deduplicated: number; timeouts: number; }
export interface AdminAnalyticsSnapshot {
  gameStats: AdminDailyGameStat[];
  economyStats: AdminEconomyStat[];
  economyOverview: AdminEconomyOverview;
  eventSummary: AdminEventSummary[];
  unsupportedDictionaryWords: AdminUnsupportedDictionaryRow[];
  loadingPerformance: AdminLoadingPerformanceRow[];
}

interface AdminCustomDictionaryRow { user_id: string; username: string | null; custom_dictionary_en: unknown; }
const GENERAL_WORDS = new Set(COMMON_WORDS_EN.map(entry => normalizeWord(entry.word)));
const parseNumber = (value: unknown): number => Number(value || 0);
const parseCustomDictionary = (value: unknown): string[] => Array.isArray(value)
  ? normalizeCustomDictionary(value.filter((word): word is string => typeof word === 'string'))
  : [];

const normalizeSnapshot = (value: Partial<AdminAnalyticsSnapshot> | null | undefined): AdminAnalyticsSnapshot => ({
  gameStats: Array.isArray(value?.gameStats) ? value!.gameStats.map(row => ({
    day: String(row.day || ''),
    game_type: row.game_type || null,
    games_started: parseNumber(row.games_started),
    games_finished: parseNumber(row.games_finished),
    games_won: parseNumber(row.games_won),
    unique_users: parseNumber(row.unique_users),
  })) : [],
  economyStats: Array.isArray(value?.economyStats) ? value!.economyStats.map(row => ({
    day: String(row.day || ''),
    coins_earned: parseNumber(row.coins_earned),
    coins_spent: parseNumber(row.coins_spent),
    purchases: parseNumber(row.purchases),
    items_used: parseNumber(row.items_used),
  })) : [],
  economyOverview: {
    total_coins: parseNumber(value?.economyOverview?.total_coins),
    users_with_coins: parseNumber(value?.economyOverview?.users_with_coins),
    kids_accounts: parseNumber(value?.economyOverview?.kids_accounts),
  },
  eventSummary: Array.isArray(value?.eventSummary) ? value!.eventSummary.map(row => ({
    event_type: String(row.event_type || ''),
    event_name: String(row.event_name || ''),
    count: parseNumber(row.count),
  })) : [],
  unsupportedDictionaryWords: Array.isArray(value?.unsupportedDictionaryWords) ? value!.unsupportedDictionaryWords.map(row => ({
    userId: String(row.userId || ''),
    username: String(row.username || 'Без имени'),
    words: Array.isArray(row.words) ? row.words.filter((word): word is string => typeof word === 'string') : [],
  })) : [],
  loadingPerformance: Array.isArray(value?.loadingPerformance) ? value!.loadingPerformance.map(row => ({
    path: String(row.path || 'unknown'),
    requests: parseNumber(row.requests),
    errors: parseNumber(row.errors),
    avg_duration_ms: parseNumber(row.avg_duration_ms),
    p95_duration_ms: parseNumber(row.p95_duration_ms),
    deduplicated: parseNumber(row.deduplicated),
    timeouts: parseNumber(row.timeouts),
  })) : [],
});

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

export const adminAnalyticsService = {
  loadSnapshot: async (): Promise<AdminAnalyticsSnapshot> => {
    if (isBackendApiConfigured) return normalizeSnapshot(await backendApiRequest<AdminAnalyticsSnapshot>('/api/analytics/admin'));

    const [gameStatsResult, economyStatsResult, eventSummaryResult, customDictionaryResult] = await Promise.all([
      supabase.from('admin_daily_game_stats').select('*').order('day', { ascending: false }).limit(30),
      supabase.from('admin_economy_stats').select('*').order('day', { ascending: false }).limit(30),
      supabase.from('analytics_events').select('event_type,event_name').order('occurred_at', { ascending: false }).limit(1000),
      supabase.rpc('get_admin_custom_dictionaries'),
    ]);
    if (gameStatsResult.error) throw gameStatsResult.error;
    if (economyStatsResult.error) throw economyStatsResult.error;
    if (eventSummaryResult.error) throw eventSummaryResult.error;
    if (customDictionaryResult.error) throw customDictionaryResult.error;

    const summaryMap = new Map<string, AdminEventSummary>();
    for (const event of eventSummaryResult.data || []) {
      const key = `${event.event_type}:${event.event_name}`;
      const current = summaryMap.get(key) || { event_type: event.event_type, event_name: event.event_name, count: 0 };
      current.count += 1;
      summaryMap.set(key, current);
    }
    const unsupportedDictionaryWords = ((customDictionaryResult.data || []) as AdminCustomDictionaryRow[])
      .map(row => ({
        userId: row.user_id,
        username: row.username || 'Без имени',
        words: parseCustomDictionary(row.custom_dictionary_en).filter(word => !GENERAL_WORDS.has(word)).sort((a, b) => a.localeCompare(b)),
      }))
      .filter(row => row.words.length > 0)
      .sort((a, b) => a.username.localeCompare(b.username));

    return normalizeSnapshot({
      gameStats: gameStatsResult.data || [],
      economyStats: economyStatsResult.data || [],
      eventSummary: Array.from(summaryMap.values()).sort((a, b) => b.count - a.count),
      unsupportedDictionaryWords,
      loadingPerformance: [],
    });
  },

  downloadEventsCsv: async (): Promise<void> => {
    if (!isBackendApiConfigured) throw new Error('CSV-выгрузка доступна через основной сервер AnnWord.');
    const token = readBackendAccessToken();
    const response = await fetch(`${backendApiBaseUrl}/api/analytics/admin/export.csv`, {
      credentials: 'include',
      headers: token ? { 'X-AnnWord-Session': token } : undefined,
    });
    if (!response.ok) throw new Error('Не удалось выгрузить события аналитики.');
    const blob = await response.blob();
    downloadBlob(blob, `annword-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
  },
};
