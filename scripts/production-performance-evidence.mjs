import fs from 'node:fs/promises';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const logFile = process.env.YANDEX_LOG_FILE || '/tmp/yandex-performance-logs.json';
const keepWarmRunsFile = process.env.KEEP_WARM_RUNS_FILE || '/tmp/keep-warm-runs.json';
const outputFile = process.env.PERFORMANCE_EVIDENCE_OUTPUT || 'performance-evidence.json';
const markdownFile = process.env.PERFORMANCE_EVIDENCE_MARKDOWN || 'performance-evidence.md';
const keepWarmStart = new Date(process.env.KEEP_WARM_START_AT || '2026-08-26T09:15:00Z');
const corsCutoff = new Date(process.env.CORS_CACHE_DEPLOYED_AT || '2026-08-24T10:35:35Z');
const corsWindowHours = Number(process.env.CORS_WINDOW_HOURS || 18);

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (Number.isNaN(keepWarmStart.getTime()) || Number.isNaN(corsCutoff.getTime())) throw new Error('Invalid evidence boundary timestamp');

const ssl = /(?:sslmode=require|ssl=true)/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined;
const client = new Client({ connectionString: databaseUrl, ssl });

const number = value => Number(value || 0);
const iso = value => new Date(value).toISOString();
const jsonRead = async (path, fallback) => {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
};

const recursiveTimestamp = value => {
  if (!value || typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value)) {
    if (/^(timestamp|time|created_at|createdAt|date)$/i.test(key) && typeof nested === 'string') {
      const parsed = Date.parse(nested);
      if (Number.isFinite(parsed)) return new Date(parsed);
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      const found = recursiveTimestamp(nested);
      if (found) return found;
    }
  }
  return null;
};

const flattenRecords = value => Array.isArray(value)
  ? value
  : Array.isArray(value?.entries) ? value.entries
    : Array.isArray(value?.messages) ? value.messages
      : Array.isArray(value?.items) ? value.items
        : [];

const summarizeLogWindow = (records, start, end) => {
  const selected = records.filter(record => {
    const timestamp = recursiveTimestamp(record);
    return timestamp && timestamp >= start && timestamp < end;
  });
  const texts = selected.map(record => JSON.stringify(record).toLowerCase());
  return {
    start: iso(start),
    end: iso(end),
    records: selected.length,
    options: texts.filter(text => /\boptions\b/.test(text)).length,
    status499: texts.filter(text => /(^|[^0-9])499([^0-9]|$)/.test(text)).length,
    coldStarts: texts.filter(text => /cold[ _-]?start/.test(text)).length,
    healthDb: texts.filter(text => /\/api\/health\/db/.test(text)).length,
  };
};

const pctDelta = (before, after) => before > 0 ? Math.round(((after - before) / before) * 1000) / 10 : null;

await client.connect();
try {
  const rumOverall = await client.query(`
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
  `);

  const releases = await client.query(`
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
  `);

  const now = new Date();
  const keepDurationMs = Math.max(1, Math.min(now.getTime() - keepWarmStart.getTime(), 6 * 60 * 60 * 1000));
  const keepBefore = new Date(keepWarmStart.getTime() - keepDurationMs);
  const keepAfter = new Date(keepWarmStart.getTime() + keepDurationMs);
  const keepRum = await client.query(`
    with windows as (
      select 'before'::text as phase, $1::timestamptz as starts, $2::timestamptz as ends
      union all
      select 'after'::text, $2::timestamptz, $3::timestamptz
    ), metrics as (
      select w.phase,
             a.event_name,
             a.payload
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
  `, [keepBefore.toISOString(), keepWarmStart.toISOString(), keepAfter.toISOString()]);

  const corsWindowMs = corsWindowHours * 60 * 60 * 1000;
  const corsBefore = new Date(corsCutoff.getTime() - corsWindowMs);
  const corsAfter = new Date(corsCutoff.getTime() + corsWindowMs);
  const corsRum = await client.query(`
    with windows as (
      select 'before'::text as phase, $1::timestamptz as starts, $2::timestamptz as ends
      union all
      select 'after'::text, $2::timestamptz, $3::timestamptz
    ), metrics as (
      select w.phase,
             a.event_name,
             a.payload
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
  `, [corsBefore.toISOString(), corsCutoff.toISOString(), corsAfter.toISOString()]);

  const logPayload = await jsonRead(logFile, []);
  const logRecords = flattenRecords(logPayload);
  const corsLogBefore = summarizeLogWindow(logRecords, corsBefore, corsCutoff);
  const corsLogAfter = summarizeLogWindow(logRecords, corsCutoff, corsAfter);
  const keepLogBefore = summarizeLogWindow(logRecords, keepBefore, keepWarmStart);
  const keepLogAfter = summarizeLogWindow(logRecords, keepWarmStart, keepAfter);

  const keepRunsPayload = await jsonRead(keepWarmRunsFile, {});
  const keepRuns = Array.isArray(keepRunsPayload?.workflow_runs) ? keepRunsPayload.workflow_runs : [];
  const scheduledAfterStart = keepRuns.filter(run => {
    const created = Date.parse(run.created_at || '');
    return Number.isFinite(created) && created >= keepWarmStart.getTime() && run.event === 'schedule';
  });
  const successfulKeepRuns = scheduledAfterStart.filter(run => run.conclusion === 'success');

  const overall = rumOverall.rows[0] || {};
  const keepRows = Object.fromEntries(keepRum.rows.map(row => [row.phase, row]));
  const corsRows = Object.fromEntries(corsRum.rows.map(row => [row.phase, row]));

  const report = {
    generatedAt: new Date().toISOString(),
    rum: {
      days: 7,
      requests: number(overall.total),
      cold: number(overall.cold),
      warm: number(overall.warm),
      errors: number(overall.errors),
      p95Ms: number(overall.p95_ms),
      releases: releases.rows.map(row => ({
        releaseSha: row.release_sha,
        requests: number(row.requests),
        cold: number(row.cold),
        warm: number(row.warm),
        p95Ms: number(row.p95_ms),
      })),
    },
    corsPreflight: {
      cutoff: corsCutoff.toISOString(),
      windowHours: corsWindowHours,
      logs: { before: corsLogBefore, after: corsLogAfter },
      rum: {
        before: corsRows.before || null,
        after: corsRows.after || null,
        p95DeltaPct: pctDelta(number(corsRows.before?.p95_ms), number(corsRows.after?.p95_ms)),
      },
    },
    keepWarm: {
      start: keepWarmStart.toISOString(),
      comparisonHours: Math.round((keepDurationMs / 3600000) * 100) / 100,
      scheduledRuns: scheduledAfterStart.length,
      successfulRuns: successfulKeepRuns.length,
      logs: { before: keepLogBefore, after: keepLogAfter },
      rum: {
        before: keepRows.before || null,
        after: keepRows.after || null,
        p95DeltaPct: pctDelta(number(keepRows.before?.p95_ms), number(keepRows.after?.p95_ms)),
        coldDeltaPct: pctDelta(number(keepRows.before?.cold), number(keepRows.after?.cold)),
      },
    },
  };

  const md = [
    '# AnnWord production performance evidence',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## RUM',
    `- 7d requests: ${report.rum.requests}; cold=${report.rum.cold}; warm=${report.rum.warm}; errors=${report.rum.errors}; p95=${report.rum.p95Ms} ms.`,
    `- Releases with server SHA metadata: ${report.rum.releases.length}.`,
    '',
    '## CORS preflight cache',
    `- Log window before: OPTIONS=${corsLogBefore.options}, 499=${corsLogBefore.status499}, cold-start markers=${corsLogBefore.coldStarts}.`,
    `- Log window after: OPTIONS=${corsLogAfter.options}, 499=${corsLogAfter.status499}, cold-start markers=${corsLogAfter.coldStarts}.`,
    `- RUM p95 before/after: ${number(corsRows.before?.p95_ms)} / ${number(corsRows.after?.p95_ms)} ms (${report.corsPreflight.rum.p95DeltaPct ?? 'n/a'}%).`,
    '',
    '## Keep warm',
    `- Scheduled runs after start: ${report.keepWarm.scheduledRuns}; successful=${report.keepWarm.successfulRuns}.`,
    `- Equal-window log cold-start markers before/after: ${keepLogBefore.coldStarts} / ${keepLogAfter.coldStarts}; health/db records after=${keepLogAfter.healthDb}.`,
    `- Equal-window RUM cold requests before/after: ${number(keepRows.before?.cold)} / ${number(keepRows.after?.cold)}; p95=${number(keepRows.before?.p95_ms)} / ${number(keepRows.after?.p95_ms)} ms.`,
    '',
  ].join('\n');

  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
  await fs.writeFile(markdownFile, md);
  process.stdout.write(`${md}\nPERFORMANCE_EVIDENCE_REPORT ${JSON.stringify(report)}\n`);

  if (report.rum.requests < 1) throw new Error('No production RUM performance events found in the last 7 days.');
  if (report.rum.releases.length < 1) throw new Error('Production RUM events do not contain release SHA metadata.');
  if (report.keepWarm.scheduledRuns < 1 || report.keepWarm.successfulRuns < 1) throw new Error('No successful scheduled keep-warm run was observed after the activation time.');
  if (logRecords.length < 1) throw new Error('No Yandex container log records were available for CORS/keep-warm evidence.');
} finally {
  await client.end();
}
