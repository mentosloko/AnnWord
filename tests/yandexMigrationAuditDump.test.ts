import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';

const textExtensions = /\.(?:ts|tsx|js|mjs|cjs|json|sql|yml|yaml|md)$/i;
const excluded = /^(?:public\/assets|assets)\//;
const patterns = [
  /supabase/ig,
  /SUPABASE/g,
  /functions\.invoke/g,
  /storage\.from/g,
  /\.rpc\(/g,
  /vercel/ig,
  /VERCEL/g,
  /\.vercel\.app/g,
  /api\/cron/g,
  /isBackendApiConfigured/g,
  /VITE_[A-Z0-9_]+/g,
  /process\.env\.[A-Z0-9_]+/g,
  /getAllUsersStats/g,
  /buyCurrentUserItem/g,
  /adminAnalyticsService/g,
  /runWeeklyReports/g,
];

const probe = async (url: string, init?: RequestInit): Promise<string> => {
  try {
    const response = await fetch(url, { redirect: 'manual', ...init });
    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 1200);
    return `${init?.method || 'GET'} ${url} -> ${response.status} ${response.headers.get('content-type') || ''} :: ${body}`;
  } catch (error) {
    return `${init?.method || 'GET'} ${url} -> NETWORK_ERROR :: ${error instanceof Error ? error.message : String(error)}`;
  }
};

describe('one-time Yandex migration audit dump', () => {
  it('prints every hosting and database migration-sensitive reference plus live contour probes', async () => {
    const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(path => textExtensions.test(path) && !excluded.test(path));
    const hits: string[] = [];
    for (const path of files) {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        if (patterns.some(pattern => { pattern.lastIndex = 0; return pattern.test(line); })) {
          hits.push(`${path}:${index + 1}:${line.trim()}`);
        }
      });
    }

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

    throw new Error(`YANDEX_MIGRATION_AUDIT_BEGIN\n${hits.join('\n')}\nLIVE_PROBES_BEGIN\n${live.join('\n')}\nLIVE_PROBES_END\nYANDEX_MIGRATION_AUDIT_END`);
  });
});
