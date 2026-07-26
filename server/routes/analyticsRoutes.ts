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

analyticsRouter.get('/admin', requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const [gameStats, economyStats, eventSummary, dictionaries, loadingPerformance, economyOverview] = await Promise.all([
      query<{
        day: string;
        game_type: string | null;
        games_started: number;
        games_finished: number;
        games_won: number;
        unique_users: number;
      }>(
        `select occurred_at::date::text as day,
                game_type,
                count(*) filter (where event_name = 'game_started')::int as games_started,
                count(*) filter (where event_name = 'game_finished')::int as games_finished,
                count(*) filter (
                  where event_name = 'game_finished'
                    and (payload->>'won' = 'true' or payload->'input'->>'won' = 'true')
                )::int as games_won,
                count(distinct user_id) filter (where user_id is not null)::int as unique_users
           from analytics_events
          where occurred_at >= current_date - interval '30 days'
            and event_name in ('game_started', 'game_finished')
          group by occurred_at::date, game_type
          order by occurred_at::date desc, game_type nulls last
          limit 120`,
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
      }>(
        `with request_metrics as (
           select coalesce(nullif(payload->>'path', ''), 'unknown') as path,
                  event_name,
                  case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric else null end as duration_ms,
                  payload->>'deduplicated' = 'true' as was_deduplicated,
                  payload->>'timedOut' = 'true' as was_timeout
             from analytics_events
            where event_type = 'performance'
              and event_name in ('request_completed', 'request_failed')
              and occurred_at >= now() - interval '7 days'
         )
         select path,
                count(*)::int as requests,
                count(*) filter (where event_name = 'request_failed')::int as errors,
                coalesce(round(avg(duration_ms)), 0)::int as avg_duration_ms,
                coalesce(round(percentile_cont(0.95) within group (order by duration_ms)), 0)::int as p95_duration_ms,
                count(*) filter (where was_deduplicated)::int as deduplicated,
                count(*) filter (where was_timeout)::int as timeouts
           from request_metrics
          group by path
          order by p95_duration_ms desc, requests desc
          limit 30`,
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
      economyStats: economyStats.rows,
      eventSummary: eventSummary.rows,
      unsupportedDictionaryWords,
      loadingPerformance: loadingPerformance.rows,
      economyOverview: economyOverview.rows[0] || { total_coins: 0, users_with_coins: 0, kids_accounts: 0 },
    });
  } catch (error) {
    console.error('Admin analytics load failed', error);
    res.status(500).json({ code: 'admin_analytics_failed', error: 'Не удалось загрузить аналитику.' });
  }
});
