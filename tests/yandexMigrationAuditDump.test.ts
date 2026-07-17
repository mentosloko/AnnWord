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
];

describe('one-time Yandex migration audit dump', () => {
  it('prints every hosting and database migration-sensitive reference', () => {
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
    throw new Error(`YANDEX_MIGRATION_AUDIT_BEGIN\n${hits.join('\n')}\nYANDEX_MIGRATION_AUDIT_END`);
  });
});
