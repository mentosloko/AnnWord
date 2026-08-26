import fs from 'node:fs/promises';

const rumFile = process.env.PERFORMANCE_RUM_FILE || '/tmp/production-rum-evidence.json';
const logFile = process.env.YANDEX_LOG_FILE || '/tmp/yandex-performance-logs.json';
const keepWarmRunsFile = process.env.KEEP_WARM_RUNS_FILE || '/tmp/keep-warm-runs.json';
const outputFile = process.env.PERFORMANCE_EVIDENCE_OUTPUT || 'performance-evidence.json';
const markdownFile = process.env.PERFORMANCE_EVIDENCE_MARKDOWN || 'performance-evidence.md';

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

const serverEvidence = await jsonRead(rumFile, null);
if (!serverEvidence?.rum || !serverEvidence?.boundaries) {
  throw new Error('Server-side production RUM evidence is missing or invalid.');
}

const keepWarmStart = new Date(serverEvidence.boundaries.keepWarmStart);
const keepBefore = new Date(serverEvidence.boundaries.keepBefore);
const keepAfter = new Date(serverEvidence.boundaries.keepAfter);
const corsCutoff = new Date(serverEvidence.boundaries.corsCutoff);
const corsBefore = new Date(serverEvidence.boundaries.corsBefore);
const corsAfter = new Date(serverEvidence.boundaries.corsAfter);
const corsWindowHours = number(serverEvidence.boundaries.corsWindowHours);
for (const [name, value] of Object.entries({ keepWarmStart, keepBefore, keepAfter, corsCutoff, corsBefore, corsAfter })) {
  if (!Number.isFinite(value.getTime())) throw new Error(`Invalid server evidence boundary: ${name}`);
}

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

const keepRows = serverEvidence.keepWarmRum || {};
const corsRows = serverEvidence.corsRum || {};
const rum = {
  days: number(serverEvidence.rum.days || 7),
  requests: number(serverEvidence.rum.requests),
  cold: number(serverEvidence.rum.cold),
  warm: number(serverEvidence.rum.warm),
  errors: number(serverEvidence.rum.errors),
  p95Ms: number(serverEvidence.rum.p95Ms),
  releases: Array.isArray(serverEvidence.rum.releases) ? serverEvidence.rum.releases : [],
};

const report = {
  generatedAt: new Date().toISOString(),
  rum,
  corsPreflight: {
    cutoff: corsCutoff.toISOString(),
    windowHours: corsWindowHours,
    logs: { before: corsLogBefore, after: corsLogAfter },
    rum: {
      before: corsRows.before || null,
      after: corsRows.after || null,
      p95DeltaPct: pctDelta(number(corsRows.before?.p95Ms), number(corsRows.after?.p95Ms)),
    },
  },
  keepWarm: {
    start: keepWarmStart.toISOString(),
    comparisonHours: number(serverEvidence.boundaries.keepComparisonHours),
    scheduledRuns: scheduledAfterStart.length,
    successfulRuns: successfulKeepRuns.length,
    logs: { before: keepLogBefore, after: keepLogAfter },
    rum: {
      before: keepRows.before || null,
      after: keepRows.after || null,
      p95DeltaPct: pctDelta(number(keepRows.before?.p95Ms), number(keepRows.after?.p95Ms)),
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
  `- RUM p95 before/after: ${number(corsRows.before?.p95Ms)} / ${number(corsRows.after?.p95Ms)} ms (${report.corsPreflight.rum.p95DeltaPct ?? 'n/a'}%).`,
  '',
  '## Keep warm',
  `- Scheduled runs after start: ${report.keepWarm.scheduledRuns}; successful=${report.keepWarm.successfulRuns}.`,
  `- Equal-window log cold-start markers before/after: ${keepLogBefore.coldStarts} / ${keepLogAfter.coldStarts}; health/db records after=${keepLogAfter.healthDb}.`,
  `- Equal-window RUM cold requests before/after: ${number(keepRows.before?.cold)} / ${number(keepRows.after?.cold)}; p95=${number(keepRows.before?.p95Ms)} / ${number(keepRows.after?.p95Ms)} ms.`,
  '',
].join('\n');

await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
await fs.writeFile(markdownFile, md);
process.stdout.write(`${md}\nPERFORMANCE_EVIDENCE_REPORT ${JSON.stringify(report)}\n`);

if (report.rum.requests < 1) throw new Error('No production RUM performance events found in the last 7 days.');
if (report.rum.releases.length < 1) throw new Error('Production RUM events do not contain release SHA metadata.');
if (report.keepWarm.scheduledRuns < 1 || report.keepWarm.successfulRuns < 1) throw new Error('No successful scheduled keep-warm run was observed after the activation time.');
if (logRecords.length < 1) throw new Error('No Yandex container log records were available for CORS/keep-warm evidence.');
