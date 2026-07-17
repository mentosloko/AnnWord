import { describe, it } from 'vitest';

const request = async (label: string, url: string, init?: RequestInit): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, ...init });
    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 500);
    return `${label}|${response.status}|${response.headers.get('content-type') || ''}|${body}`;
  } catch (error) {
    return `${label}|NETWORK_ERROR||${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timeout);
  }
};

describe('one-time Yandex runtime diagnostic', () => {
  it('prints every live smoke probe independently', async () => {
    const rows: string[] = [];
    rows.push(await request('health', 'https://api.annword.ru/api/health'));
    rows.push(await request('db', 'https://api.annword.ru/api/health/db'));
    rows.push(await request('runtime', 'https://api.annword.ru/api/runtime-config'));
    rows.push(await request('weekly-status', 'https://api.annword.ru/api/reports/weekly/status'));
    rows.push(await request('prodamus', 'https://api.annword.ru/api/payments/prodamus/notify'));
    rows.push(await request('profile-auth', 'https://api.annword.ru/api/profile/me'));
    rows.push(await request('analytics-admin-auth', 'https://api.annword.ru/api/analytics/admin'));
    rows.push(await request('weekly-run-auth', 'https://api.annword.ru/api/reports/weekly/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
    rows.push(await request('migration-prepare', 'https://api.annword.ru/api/admin/migration/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
    rows.push(await request('migration-supabase', 'https://api.annword.ru/api/admin/migration/supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"apply":false}' }));
    for (const route of ['/', '/practice', '/kids', '/premium', '/setup']) {
      rows.push(await request(`frontend:${route}`, `https://annword.ru${route}`));
    }
    rows.push(await request('release', 'https://annword.ru/release.json'));
    throw new Error(`YANDEX_RUNTIME_DIAGNOSTIC_BEGIN\n${rows.join('\n')}\nYANDEX_RUNTIME_DIAGNOSTIC_END`);
  }, 120_000);
});
