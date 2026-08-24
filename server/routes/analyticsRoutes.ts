import type { NextFunction, Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { requireAuth } from '../auth';
import { query } from '../db';
import { optionalAuth } from '../optionalAuth';
import { insertAnalyticsEvents } from '../activityEventRepository';
import { COMMON_WORDS_EN } from '../../dictionaries/english';
import { normalizeCustomDictionary, normalizeWord } from '../../services/dictionaryEngine';

export const analyticsRouter = Router();
const GENERAL_DICTIONARY_WORDS = new Set(COMMON_WORDS_EN.map(entry => normalizeWord(entry.word)));

type AdminLoadingWarmState = 'all' | 'cold' | 'warm';

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    try {
      const result = await query<{ role: string | null }>('select role from profiles where id = $1', [req.user!.id]);
      if (result.rows[0]?.role !== 'admin') {
        res.status(403).json({ code: 'admin_required', error: 'Forbidden' });
        return;
      }
      next();
    } catch (error) {
      console.error('Admin authorization failed', error);
      res.status(500).json({ code: 'admin_check_failed', error: 'Admin authorization failed' });
    }
  });
}

analyticsRouter.post('/events', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const inserted = await insertAnalyticsEvents(req.user?.id || null, req.body?.events ?? req.body, 50);
    res.json({ ok: true, inserted });
  } catch (error) {
    console.error('Analytics events write failed', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Analytics events write failed' });
  }
});

const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RELEASE_SHA_PATTERN = /^[a-f0-9]{7,40}$/i;
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const shiftIsoDate = (value: string, days: number): string => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
};
const dateQueryValue = (value: unknown): string | null => typeof value === 'string' && ISO_DATE_PATTERN.test(value) ? value : null;
const resolveAdminGameRange = (fromValue: unknown, toValue: unknown): { from: string; to: string } => {
  const today = isoDate(new Date());
  let to = dateQueryValue(toValue) || today;
  let from = dateQueryValue(fromValue) || shiftIsoDate(to, -29);
  if (from > to) [from, to] = [to, from];
  return { from, to };
};
const resolvePerformanceDays = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(90, Math.max(1, parsed)) : 7;
};
const resolvePerformanceRelease = (value: unknown): string => typeof value === 'string' && RELEASE_SHA_PATTERN.test(value) ? value.slice(0, 40) : '';
const resolvePerformanceWarmState = (value: unknown): AdminLoadingWarmState => value === 'cold' || value === 'warm' ? value : 'all';

analyticsRouter.get('/admin/export.csv', requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const result = await query<Record<string, unknown>>(
      `select *
         from (
           select 'analytics'::text as source,
                  id::text,
                  user_id::text,
                  session_id,
                  event_type,
                  event_name,
                  game_type,
                  route,
                  null::text as word,
                  null::text as result,
                  null::integer as coins_delta,
                  null::integer as xp_delta,
                  occurred_at,
                  payload,
                  app_version,
                  device_type
             from analytics_events
           union all
           select 'game'::text as source,
                  id::text,
                  user_id::text,
                  null::text as session_id,
                  event_type,
                  event_type as event_name,
                  game_mode as game_type,
                  null::text as route,
                  word,
                  result,
                  coins_delta,
                  xp_delta,
                  occurred_at,
                  payload,
                  null::text as app_version,
                  null::text as device_type
             from game_events
         ) all_events
        order by occurred_at desc`,
    );
    const columns = ['source', 'id', 'user_id', 'session_id', 'event_type', 'event_name', 'game_type', 'route', 'word', 'result', 'coins_delta', 'xp_delta', 'occurred_at', 'payload', 'app_version', 'device_type'];
    const lines = [
      columns.map(csvCell).join(','),
      ...result.rows.map(row => columns.map(column => csvCell(column === 'payload' ? JSON.stringify(row[column] ?? {}) : row[column])).join(',')),
    ];
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="annword-analytics-${date}.csv"`);
    res.send(`\uFEFF${lines.join('\n')}`);
  } catch (error) {
    console.error('Analytics CSV export failed', error);
    res.status(500).json({ code: 'analytics_export_failed', error: 'Не удалось выгрузить аналитику.' });
  }
});

analyticsRouter.get('/admin', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const gameRange = resolveAdminGameRange(req.query?.from, req.query?.to);
    const performanceDays = resolvePerformanceDays(req.query?.performanceDays);
    const performanceRelease = resolvePerformanceRelease(req.query?.performanceRelease);
    const performanceWarmState = resolvePerformanceWarmState(req.query?.performanceWarmState);
    const [gameStats, economyStats, eventSummary, dictionaries, loadingPerformance, loadingReleases, economyOverview] = await Promise.all([
      query<{
        game_type: string | null;
        games_started: number;
        games_finished: number;
        games_won: number;
        unique_users: number;
        inferred_starts: number;
      }>(
        `with analytics_by_actor as (
           select coalesce(game_type, 'other') as game_type,
                  coalesce(user_id::text, nullif(session_id, ''), 'anonymous') as actor_key,
                  count(*) filter (where event_name = 'game_started')::int as starts,
                  count(*) filter (where event_name = 'game_finished')::int as finishes,
                  count(*) filter (
                    where event_name = 'game_finished'
                      and (
                        payload->>'won' = 'true'
                        or (coalesce(payload->>'guessedWords', '') ~ '^[0-9]+$' and (payload->>'guessedWords')::int > 0)
                        or (coalesce(payload->>'clicks', '') ~ '^[0-9]+$' and (payload->>'clicks')::int > 0)
                      )
                  )::int as wins
             from analytics_events
            where occurred_at >= $1::date
              and occurred_at < ($2::date + interval '1 day')
              and event_name in ('game_started', 'game_finished')
            group by coalesce(game_type, 'other'), coalesce(user_id::text, nullif(session_id, ''), 'anonymous')
         ), ledger_by_actor as (
           select coalesce(game_mode, 'other') as game_type,
                  user_id::text as actor_key,
                  count(*) filter (where event_type = 'game_started')::int as starts,
                  count(*) filter (where event_type = 'game_finished')::int as finishes,
                  count(*) filter (
                    where event_type = 'game_finished'
                      and (
                        payload->'input'->>'won' = 'true'
                        or (coalesce(payload->'input'->>'guessedWords', '') ~ '^[0-9]+$' and (payload->'input'->>'guessedWords')::int > 0)
                        or (coalesce(payload->'input'->>'clicks', '') ~ '^[0-9]+$' and (payload->'input'->>'clicks')::int > 0)
                      )
                  )::int as wins
             from game_events
            where occurred_at >= $1::date
              and occurred_at < ($2::date + interval '1 day')
              and event_type in ('game_started', 'game_finished')
            group by coalesce(game_mode, 'other'), user_id::text
         ), actors as (
           select coalesce(analytics.game_type, ledger.game_type) as game_type,
                  coalesce(analytics.actor_key, ledger.actor_key) as actor_key,
                  greatest(coalesce(analytics.starts, 0), coalesce(ledger.starts, 0)) as recorded_starts,
                  greatest(coalesce(analytics.finishes, 0), coalesce(ledger.finishes, 0)) as finishes,
                  greatest(coalesce(analytics.wins, 0), coalesce(ledger.wins, 0)) as wins
             from analytics_by_actor analytics
             full join ledger_by_actor ledger using (game_type, actor_key)
         )
         select game_type,
                coalesce(sum(greatest(recorded_starts, finishes)), 0)::int as games_started,
                coalesce(sum(finishes), 0)::int as games_finished,
                coalesce(sum(wins), 0)::int as games_won,
                count(*)::int as unique_users,
                coalesce(sum(greatest(finishes - recorded_starts, 0)), 0)::int as inferred_starts
           from actors
          group by game_type
          order by games_started desc, game_type`,
        [gameRange.from, gameRange.to],
      ),
      query<{
        day: string;
        coins_earned: number;
        coins_spent: number;
        purchases: number;
        items_used: number;
      }>(
        `with days as (
           select occurred_at::date as day from game_events where occurred_at >= current_date - interval '30 days'
           union
           select occurred_at::date as day from analytics_events where occurred_at >= current_date - interval '30 days'
         ), rewards as (
           select occurred_at::date as day, coalesce(sum(greatest(coins_delta, 0)), 0)::int as coins_earned
             from game_events
            where occurred_at >= current_date - interval '30 days'
              and event_type = 'reward_granted'
            group by occurred_at::date
         ), client_events as (
           select occurred_at::date as day,
                  coalesce(sum(case
                    when event_name = 'shop_item_bought'
                     and jsonb_typeof(payload->'coinsBefore') = 'number'
                     and jsonb_typeof(payload->'coinsAfter') = 'number'
                    then greatest((payload->>'coinsBefore')::numeric - (payload->>'coinsAfter')::numeric, 0)
                    else 0 end), 0)::int as coins_spent,
                  count(*) filter (where event_name = 'shop_item_bought')::int as purchases,
                  count(*) filter (where event_name = 'inventory_item_used')::int as items_used
             from analytics_events
            where occurred_at >= current_date - interval '30 days'
            group by occurred_at::date
         )
         select d.day::text as day,
                coalesce(r.coins_earned, 0)::int as coins_earned,
                coalesce(c.coins_spent, 0)::int as coins_spent,
                coalesce(c.purchases, 0)::int as purchases,
                coalesce(c.items_used, 0)::int as items_used
           from days d
           left join rewards r on r.day = d.day
           left join client_events c on c.day = d.day
          order by d.day desc
          limit 30`,
      ),
      query<{ event_type: string; event_name: string; count: number }>(
        `select event_type, event_name, count(*)::int as count
           from (
             select event_type, event_name
               from analytics_events
              order by occurred_at desc
              limit 1000
           ) recent
          group by event_type, event_name
          order by count(*) desc, event_type, event_name`,
      ),
      query<{ id: string; username: string | null; custom_dictionary_en: unknown }>(
        `select id, username, custom_dictionary_en
           from profiles
          where jsonb_typeof(custom_dictionary_en) = 'array'
            and jsonb_array_length(custom_dictionary_en) > 0
          order by username nulls last
          limit 2000`,
      ),
      query<{
        path: string;
        requests: number;
        errors: number;
        avg_duration_ms: number;
        p95_duration_ms: number;
        deduplicated: number;
        timeouts: number;
        cold_requests: number;
        cold_p95_duration_ms: number;
        warm_requests: number;
        warm_p95_duration_ms: number;
      }>(
        `with request_metrics as (
           select coalesce(nullif(payload->>'path', ''), 'unknown') as path,
                  event_name,
                  case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric else null end as duration_ms,
                  payload->>'deduplicated' = 'true' as was_deduplicated,
                  payload->>'timedOut' = 'true' as was_timeout,
                  case
                    when payload->>'coldStart' = 'true' then true
                    when payload->>'coldStart' = 'false' then false
                    else null
                  end as cold_start
             from analytics_events
            where event_type = 'performance'
              and event_name in ('request_completed', 'request_failed')
              and occurred_at >= now() - ($1::int * interval '1 day')
              and ($2::text = '' or payload->>'releaseSha' = $2::text)
              and (
                $3::text = 'all'
                or ($3::text = 'cold' and payload->>'coldStart' = 'true')
                or ($3::text = 'warm' and payload->>'coldStart' = 'false')
              )
         )
         select path,
                count(*)::int as requests,
                count(*) filter (where event_name = 'request_failed')::int as errors,
                coalesce(round(avg(duration_ms)), 0)::int as avg_duration_ms,
                coalesce(round(percentile_cont(0.95) within group (order by duration_ms)), 0)::int as p95_duration_ms,
                count(*) filter (where was_deduplicated)::int as deduplicated,
                count(*) filter (where was_timeout)::int as timeouts,
                count(*) filter (where cold_start is true)::int as cold_requests,
                coalesce(round(percentile_cont(0.95) within group (order by duration_ms) filter (where cold_start is true)), 0)::int as cold_p95_duration_ms,
                count(*) filter (where cold_start is false)::int as warm_requests,
                coalesce(round(percentile_cont(0.95) within group (order by duration_ms) filter (where cold_start is false)), 0)::int as warm_p95_duration_ms
           from request_metrics
          group by path
          order by p95_duration_ms desc, requests desc
          limit 30`,
        [performanceDays, performanceRelease, performanceWarmState],
      ),
      query<{ release_sha: string; requests: number }>(
        `select payload->>'releaseSha' as release_sha,
                count(*)::int as requests
           from analytics_events
          where event_type = 'performance'
            and event_name in ('request_completed', 'request_failed')
            and occurred_at >= now() - interval '90 days'
            and coalesce(payload->>'releaseSha', '') <> ''
          group by payload->>'releaseSha'
          order by max(occurred_at) desc
          limit 20`,
      ),
      query<{ total_coins: number; users_with_coins: number; kids_accounts: number }>(
        `select coalesce(sum(greatest(coins, 0)), 0)::int as total_coins,
                count(*) filter (where coins > 0)::int as users_with_coins,
                count(*) filter (where role = 'parent' or account_mode = 'parent')::int as kids_accounts
           from profiles`,
      ),
    ]);

    const unsupportedDictionaryWords = dictionaries.rows
      .map(row => {
        const words = Array.isArray(row.custom_dictionary_en)
          ? normalizeCustomDictionary(row.custom_dictionary_en.filter((word): word is string => typeof word === 'string'))
          : [];
        return {
          userId: row.id,
          username: row.username || 'Без имени',
          words: words.filter(word => !GENERAL_DICTIONARY_WORDS.has(word)).sort((first, second) => first.localeCompare(second)),
        };
      })
      .filter(row => row.words.length > 0)
      .sort((first, second) => first.username.localeCompare(second.username));

    res.json({
      gameStats: gameStats.rows,
      gameRange,
      economyStats: economyStats.rows,
      eventSummary: eventSummary.rows,
      unsupportedDictionaryWords,
      loadingPerformance: loadingPerformance.rows,
      loadingPerformanceFilters: {
        days: performanceDays,
        releaseSha: performanceRelease || null,
        warmState: performanceWarmState,
        releases: loadingReleases.rows,
      },
      economyOverview: economyOverview.rows[0] || { total_coins: 0, users_with_coins: 0, kids_accounts: 0 },
    });
  } catch (error) {
    console.error('Admin analytics load failed', error);
    res.status(500).json({ code: 'admin_analytics_failed', error: 'Не удалось загрузить аналитику.' });
  }
});
