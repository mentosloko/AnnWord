import { describe, it } from 'vitest';

const probe = async (url: string, init?: RequestInit): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal, ...init });
    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 1800);
    return `${init?.method || 'GET'} ${url} -> ${response.status} ${response.headers.get('content-type') || ''} :: ${body}`;
  } catch (error) {
    return `${init?.method || 'GET'} ${url} -> NETWORK_ERROR :: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timeout);
  }
};

describe('one-time Yandex live migration audit', () => {
  it('captures the live frontend and API contour', async () => {
    const live = await Promise.all([
      probe('https://api.annword.ru/api/health'),
      probe('https://api.annword.ru/api/health/db'),
      probe('https://api.annword.ru/api/runtime-config'),
      probe('https://annword.ru/release.json'),
      probe('https://api.annword.ru/api/payments/prodamus/notify'),
      probe('https://api.annword.ru/api/auth/me'),
      probe('https://api.annword.ru/api/profile/me'),
      probe('https://api.annword.ru/api/admin/analytics'),
      probe('https://api.annword.ru/api/reports/weekly/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
      probe('https://api.annword.ru/api/admin/migration/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
      probe('https://api.annword.ru/api/admin/migration/supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"apply":false}' }),
    ]);
    throw new Error(`LIVE_PROBES_BEGIN\n${live.join('\n')}\nLIVE_PROBES_END`);
  }, 30_000);
});
