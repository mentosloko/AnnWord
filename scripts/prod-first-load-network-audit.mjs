import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = (process.env.APP_URL || 'https://annword.ru').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'https://api.annword.ru').replace(/\/$/, '');
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || 'artifacts/first-load-network');
const WAIT_AFTER_IDLE_MS = Number(process.env.WAIT_AFTER_IDLE_MS || 2500);

const ensureDir = async () => fs.mkdir(OUTPUT_DIR, { recursive: true });
const round = (value) => Math.round(Number(value || 0) * 10) / 10;
const stripVolatileQuery = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(t|ts|timestamp|cache|cacheBust|_cb|_)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return rawUrl;
  }
};

const summarizeGroups = (requests, keyBuilder) => {
  const groups = new Map();
  for (const request of requests) {
    const key = keyBuilder(request);
    const current = groups.get(key) || [];
    current.push(request);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      count: items.length,
      methods: [...new Set(items.map((item) => item.method))],
      statuses: [...new Set(items.map((item) => item.status).filter((item) => item !== null))],
      startsMs: items.map((item) => item.startedMs),
      resourceTypes: [...new Set(items.map((item) => item.resourceType))],
      totalTransferBytes: items.reduce((sum, item) => sum + (item.transferSize || 0), 0),
      serverTiming: items.map((item) => item.serverTiming).filter(Boolean),
    }))
    .filter((group) => group.count > 1)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};

const buildReport = (result) => {
  const lines = [
    '# AnnWord production first-load network audit',
    '',
    `Measured at: ${result.measuredAt}`,
    `Runner: ${result.runner}`,
    '',
  ];
  for (const scenario of result.scenarios) {
    lines.push(`## ${scenario.name}`, '');
    lines.push(`- Final URL: ${scenario.finalUrl}`);
    lines.push(`- Requests: ${scenario.requestCount}`);
    lines.push(`- API requests: ${scenario.apiRequestCount}`);
    lines.push(`- Failed requests: ${scenario.failedRequestCount}`);
    lines.push(`- Resource transfer: ${scenario.performance.totalTransferBytes} bytes`);
    lines.push(`- FCP: ${scenario.performance.fcpMs} ms`);
    lines.push(`- LCP: ${scenario.performance.lcpMs} ms`);
    lines.push(`- Load event: ${scenario.performance.loadEventMs} ms`);
    lines.push('');
    lines.push('### API sequence', '');
    lines.push('| Start | Method | Status | URL | Server-Timing |');
    lines.push('|---:|---|---:|---|---|');
    for (const request of scenario.apiRequests) {
      lines.push(`| ${request.startedMs} ms | ${request.method} | ${request.status ?? ''} | ${request.url} | ${request.serverTiming || ''} |`);
    }
    lines.push('');
    lines.push('### Exact duplicate requests', '');
    if (!scenario.exactDuplicates.length) lines.push('None.');
    else {
      lines.push('| Count | Request | Starts | Statuses |');
      lines.push('|---:|---|---|---|');
      for (const duplicate of scenario.exactDuplicates) lines.push(`| ${duplicate.count} | ${duplicate.key} | ${duplicate.startsMs.join(', ')} | ${duplicate.statuses.join(', ')} |`);
    }
    lines.push('');
    lines.push('### Logical duplicate requests', '');
    if (!scenario.logicalDuplicates.length) lines.push('None.');
    else {
      lines.push('| Count | Request | Starts | Statuses |');
      lines.push('|---:|---|---|---|');
      for (const duplicate of scenario.logicalDuplicates) lines.push(`| ${duplicate.count} | ${duplicate.key} | ${duplicate.startsMs.join(', ')} | ${duplicate.statuses.join(', ')} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
};

const runScenario = async (browser, { name, authenticated }) => {
  const harPath = path.join(OUTPUT_DIR, `${name}.har`);
  const context = await browser.newContext({
    recordHar: { path: harPath, content: 'omit', mode: 'full' },
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    userAgent: 'AnnWord-First-Load-Audit/1.0',
  });

  let testAccount = null;
  if (authenticated) {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    testAccount = {
      email: `annword.benchmark.${unique}@yandex.ru`,
      credential: `AnnWordBenchmark!${unique}Aa9`,
    };
    const registration = await context.request.post(`${API_URL}/api/auth/email/account`, {
      data: {
        email: testAccount.email,
        credential: testAccount.credential,
        name: 'Production benchmark',
        consents: {
          termsAccepted: true,
          personalDataAccepted: true,
          marketingEmailsAccepted: false,
        },
      },
      timeout: 30_000,
    });
    if (!registration.ok()) {
      throw new Error(`Benchmark registration failed: ${registration.status()} ${await registration.text()}`);
    }
  }

  const page = await context.newPage();
  const startedAt = Date.now();
  const requests = [];
  const requestIndex = new WeakMap();

  page.on('request', (request) => {
    const record = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startedMs: Date.now() - startedAt,
      status: null,
      failed: false,
      failure: null,
      serverTiming: null,
      cacheControl: null,
      transferSize: 0,
    };
    requestIndex.set(request, record);
    requests.push(record);
  });
  page.on('response', async (response) => {
    const record = requestIndex.get(response.request());
    if (!record) return;
    record.status = response.status();
    const headers = await response.allHeaders().catch(() => ({}));
    record.serverTiming = headers['server-timing'] || null;
    record.cacheControl = headers['cache-control'] || null;
  });
  page.on('requestfailed', (request) => {
    const record = requestIndex.get(request);
    if (!record) return;
    record.failed = true;
    record.failure = request.failure()?.errorText || 'unknown';
  });

  await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(WAIT_AFTER_IDLE_MS);

  const performance = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    const navigation = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
    const lcpEntries = [];
    const observerSupported = typeof PerformanceObserver !== 'undefined';
    return {
      observerSupported,
      resourceCount: resources.length,
      totalTransferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      totalEncodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
      totalDecodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
      fcpMs: paints['first-contentful-paint'] || 0,
      loadEventMs: navigation?.loadEventEnd || 0,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd || 0,
      responseStartMs: navigation?.responseStart || 0,
      resources: resources.map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        duration: entry.duration,
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
      })),
      lcpEntries,
    };
  });

  const lcpMs = await page.evaluate(() => new Promise((resolve) => {
    if (typeof PerformanceObserver === 'undefined') { resolve(0); return; }
    let value = 0;
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) value = entries.at(-1).startTime;
    });
    try { observer.observe({ type: 'largest-contentful-paint', buffered: true }); } catch { resolve(0); return; }
    setTimeout(() => { observer.disconnect(); resolve(value); }, 100);
  }));
  performance.lcpMs = lcpMs;

  const resourceByName = new Map(performance.resources.map((entry) => [entry.name, entry]));
  for (const request of requests) {
    const resource = resourceByName.get(request.url);
    if (resource) request.transferSize = resource.transferSize;
  }

  const apiRequests = requests
    .filter((request) => request.url.startsWith(API_URL))
    .map((request) => ({ ...request, startedMs: round(request.startedMs) }));
  const exactDuplicates = summarizeGroups(requests, (request) => `${request.method} ${request.url}`);
  const logicalDuplicates = summarizeGroups(requests, (request) => `${request.method} ${stripVolatileQuery(request.url)}`);

  const result = {
    name,
    authenticated,
    testAccountEmail: testAccount?.email || null,
    finalUrl: page.url(),
    requestCount: requests.length,
    apiRequestCount: apiRequests.length,
    failedRequestCount: requests.filter((request) => request.failed).length,
    requests,
    apiRequests,
    exactDuplicates,
    logicalDuplicates,
    performance: {
      ...performance,
      fcpMs: round(performance.fcpMs),
      lcpMs: round(performance.lcpMs),
      loadEventMs: round(performance.loadEventMs),
      domContentLoadedMs: round(performance.domContentLoadedMs),
      responseStartMs: round(performance.responseStartMs),
    },
  };

  await fs.writeFile(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(result, null, 2));
  await context.close();
  return result;
};

await ensureDir();
const browser = await chromium.launch({ headless: true });
try {
  const scenarios = [];
  scenarios.push(await runScenario(browser, { name: 'anonymous-cold-start', authenticated: false }));
  scenarios.push(await runScenario(browser, { name: 'authenticated-cold-start', authenticated: true }));
  const result = {
    measuredAt: new Date().toISOString(),
    runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    appUrl: APP_URL,
    apiUrl: API_URL,
    scenarios,
  };
  const report = buildReport(result);
  await fs.writeFile(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(OUTPUT_DIR, 'REPORT.md'), report);
  process.stdout.write(report);
} finally {
  await browser.close();
}
