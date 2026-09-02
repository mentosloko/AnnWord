import { query } from './db';

export interface PerformanceEvidenceBoundaries {
  keepWarmStart: string;
  corsCutoff: string;
  corsWindowHours: number;
  preparedBaselineStart: string;
  preparedInstanceStart: string;
  preparedWindowHours: number;
  generatedAt?: string;
}

const numeric = (value: unknown): number => Number(value || 0);

const readIsoDate = (value: string, field: string): Date => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid ${field}`);
  return parsed;
};

export async function readPerformanceRumEvidence(boundaries: PerformanceEvidenceBoundaries) {
  const keepWarmStart = readIsoDate(boundaries.keepWarmStart, 'keepWarmStart');
  const corsCutoff = readIsoDate(boundaries.corsCutoff, 'corsCutoff');
  const preparedBaselineStart = readIsoDate(boundaries.preparedBaselineStart, 'preparedBaselineStart');
  const preparedInstanceStart = readIsoDate(boundaries.preparedInstanceStart, 'preparedInstanceStart');
  const now = boundaries.generatedAt ? readIsoDate(boundaries.generatedAt, 'generatedAt') : new Date();
  const corsWindowHours = Math.min(72, Math.max(1, Math.round(Number(boundaries.corsWindowHours) || 18)));
  const preparedWindowHours = Math.min(72, Math.max(1, Math.round(Number(boundaries.preparedWindowHours) || 24)));
  const keepDurationMs = Math.max(1, Math.min(now.getTime() - keepWarmStart.getTime(), 6 * 60 * 60 * 1000));
  const keepBefore = new Date(keepWarmStart.getTime() - keepDurationMs);
  const keepAfter = new Date(keepWarmStart.getTime() + keepDurationMs);
  const corsWindowMs = corsWindowHours * 60 * 60 * 1000;
  const corsBefore = new Date(corsCutoff.getTime() - corsWindowMs);
  const corsAfter = new Date(corsCutoff.getTime() + corsWindowMs);
  const preparedWindowMs = preparedWindowHours * 60 * 60 * 1000;
  const preparedBaselineEnd = new Date(preparedBaselineStart.getTime() + preparedWindowMs);
  const preparedInstanceEnd = new Date(preparedInstanceStart.getTime() + preparedWindowMs);

  const [rumOverall, releases, keepRum, corsRum, preparedRum] = await Promise.all([
    query<{ total: number; cold: number; warm: number; errors: number; p95_ms: number }>(`
      select count(*)::int as total,
             count(*) filter (where payload->>'coldStart' = 'true')::int as cold,
             count(*) filter (where payload->>'coldStart' = 'false')::int as warm,
             count(*) filter (where event_name = 'request_failed')::int as errors,
             coalesce(round(percentile_cont(0.95) within group (
               order by case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric end
             )), 0)::int as p95_ms
        from analytics_events
       where event_type = 'performance'
         and event_name in ('request_completed', 'request_failed')
         and occurred_at >= now() - interval '7 days'
    `),
    query<{ release_sha: string; requests: number; cold: number; warm: number; p95_ms: number }>(`
      select payload->>'releaseSha' as release_sha,
             count(*)::int as requests,
             count(*) filter (where payload->>'coldStart' = 'true')::int as cold,
             count(*) filter (where payload->>'coldStart' = 'false')::int as warm,
             coalesce(round(percentile_cont(0.95) within group (
               order by case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric end
             )), 0)::int as p95_ms
        from analytics_events
       where event_type = 'performance'
         and event_name in ('request_completed', 'request_failed')
         and occurred_at >= now() - interval '7 days'
         and coalesce(payload->>'releaseSha', '') <> ''
       group by payload->>'releaseSha'
       order by max(occurred_at) desc
       limit 10
    `),
    query<{ phase: 'before' | 'after'; requests: number; cold: number; warm: number; p95_ms: number }>(`
      with windows as (
        select 'before'::text as phase, $1::timestamptz as starts, $2::timestamptz as ends
        union all
        select 'after'::text, $2::timestamptz, $3::timestamptz
      ), metrics as (
        select w.phase, a.event_name, a.payload
          from windows w
          left join analytics_events a
            on a.occurred_at >= w.starts and a.occurred_at < w.ends
           and a.event_type = 'performance'
           and a.event_name in ('request_completed', 'request_failed')
      )
      select phase,
             count(*) filter (where event_name is not null)::int as requests,
             count(*) filter (where payload->>'coldStart' = 'true')::int as cold,
             count(*) filter (where payload->>'coldStart' = 'false')::int as warm,
             coalesce(round(percentile_cont(0.95) within group (
               order by case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric end
             )), 0)::int as p95_ms
        from metrics
       group by phase
       order by phase
    `, [keepBefore.toISOString(), keepWarmStart.toISOString(), keepAfter.toISOString()]),
    query<{ phase: 'before' | 'after'; requests: number; errors: number; cold: number; p95_ms: number }>(`
      with windows as (
        select 'before'::text as phase, $1::timestamptz as starts, $2::timestamptz as ends
        union all
        select 'after'::text, $2::timestamptz, $3::timestamptz
      ), metrics as (
        select w.phase, a.event_name, a.payload
          from windows w
          left join analytics_events a
            on a.occurred_at >= w.starts and a.occurred_at < w.ends
           and a.event_type = 'performance'
           and a.event_name in ('request_completed', 'request_failed')
      )
      select phase,
             count(*) filter (where event_name is not null)::int as requests,
             count(*) filter (where event_name = 'request_failed')::int as errors,
             count(*) filter (where payload->>'coldStart' = 'true')::int as cold,
             coalesce(round(percentile_cont(0.95) within group (
               order by case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric end
             )), 0)::int as p95_ms
        from metrics
       group by phase
       order by phase
    `, [corsBefore.toISOString(), corsCutoff.toISOString(), corsAfter.toISOString()]),
    query<{
      phase: 'baseline' | 'prepared';
      scope: 'all_api' | 'profile_bootstrap' | 'daily_quest_today';
      requests: number;
      errors: number;
      timeouts: number;
      status_5xx: number;
      cold: number;
      warm: number;
      p50_ms: number;
      p95_ms: number;
    }>(`
      with windows as (
        select 'baseline'::text as phase, $1::timestamptz as starts, $2::timestamptz as ends
        union all
        select 'prepared'::text, $3::timestamptz, $4::timestamptz
      ), scopes as (
        select 'all_api'::text as scope, null::text as exact_path
        union all select 'profile_bootstrap'::text, '/api/profile/bootstrap'::text
        union all select 'daily_quest_today'::text, '/api/daily-quest/today'::text
      ), metrics as (
        select w.phase, s.scope, a.event_name, a.payload
          from windows w
          cross join scopes s
          left join analytics_events a
            on a.occurred_at >= w.starts and a.occurred_at < w.ends
           and a.event_type = 'performance'
           and a.event_name in ('request_completed', 'request_failed')
           and (s.exact_path is null or payload->>'path' = s.exact_path)
      )
      select phase,
             scope,
             count(*) filter (where event_name is not null)::int as requests,
             count(*) filter (where event_name = 'request_failed')::int as errors,
             count(*) filter (where payload->>'timedOut' = 'true')::int as timeouts,
             count(*) filter (
               where coalesce(payload->>'statusCode', payload->>'status', '') ~ '^[0-9]+$'
                 and coalesce(payload->>'statusCode', payload->>'status')::int >= 500
             )::int as status_5xx,
             count(*) filter (where payload->>'coldStart' = 'true')::int as cold,
             count(*) filter (where payload->>'coldStart' = 'false')::int as warm,
             coalesce(round(percentile_cont(0.50) within group (
               order by case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric end
             )), 0)::int as p50_ms,
             coalesce(round(percentile_cont(0.95) within group (
               order by case when payload->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' then (payload->>'durationMs')::numeric end
             )), 0)::int as p95_ms
        from metrics
       group by phase, scope
       order by phase, scope
    `, [
      preparedBaselineStart.toISOString(),
      preparedBaselineEnd.toISOString(),
      preparedInstanceStart.toISOString(),
      preparedInstanceEnd.toISOString(),
    ]),
  ]);

  const overall = rumOverall.rows[0] || { total: 0, cold: 0, warm: 0, errors: 0, p95_ms: 0 };
  return {
    generatedAt: now.toISOString(),
    boundaries: {
      keepWarmStart: keepWarmStart.toISOString(),
      keepBefore: keepBefore.toISOString(),
      keepAfter: keepAfter.toISOString(),
      keepComparisonHours: Math.round((keepDurationMs / 3_600_000) * 100) / 100,
      corsCutoff: corsCutoff.toISOString(),
      corsBefore: corsBefore.toISOString(),
      corsAfter: corsAfter.toISOString(),
      corsWindowHours,
      preparedBaselineStart: preparedBaselineStart.toISOString(),
      preparedBaselineEnd: preparedBaselineEnd.toISOString(),
      preparedInstanceStart: preparedInstanceStart.toISOString(),
      preparedInstanceEnd: preparedInstanceEnd.toISOString(),
      preparedWindowHours,
    },
    rum: {
      days: 7,
      requests: numeric(overall.total),
      cold: numeric(overall.cold),
      warm: numeric(overall.warm),
      errors: numeric(overall.errors),
      p95Ms: numeric(overall.p95_ms),
      releases: releases.rows.map(row => ({
        releaseSha: row.release_sha,
        requests: numeric(row.requests),
        cold: numeric(row.cold),
        warm: numeric(row.warm),
        p95Ms: numeric(row.p95_ms),
      })),
    },
    keepWarmRum: Object.fromEntries(keepRum.rows.map(row => [row.phase, {
      requests: numeric(row.requests),
      cold: numeric(row.cold),
      warm: numeric(row.warm),
      p95Ms: numeric(row.p95_ms),
    }])),
    corsRum: Object.fromEntries(corsRum.rows.map(row => [row.phase, {
      requests: numeric(row.requests),
      errors: numeric(row.errors),
      cold: numeric(row.cold),
      p95Ms: numeric(row.p95_ms),
    }])),
    preparedInstanceRum: Object.fromEntries(['baseline', 'prepared'].map(phase => [
      phase,
      Object.fromEntries(preparedRum.rows.filter(row => row.phase === phase).map(row => [row.scope, {
        requests: numeric(row.requests),
        errors: numeric(row.errors),
        timeouts: numeric(row.timeouts),
        status5xx: numeric(row.status_5xx),
        cold: numeric(row.cold),
        warm: numeric(row.warm),
        p50Ms: numeric(row.p50_ms),
        p95Ms: numeric(row.p95_ms),
      }])),
    ])),
  };
}
