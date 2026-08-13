import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');

const serviceFiles = (): string[] => readdirSync('services', { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
  .map(entry => `services/${entry.name}`);

describe('Yandex-only production contract', () => {
  it('keeps Supabase out of the client service runtime', () => {
    const offenders = serviceFiles().filter(path => /from\s+['"]\.\.\/supabase['"]|from\s+['"]\.\/supabase['"]/.test(read(path)));
    expect(offenders).toEqual([]);
    expect(existsSync('services/petMoodClock.ts')).toBe(false);
  });

  it('keeps legacy migration secrets out of the Yandex production deploy', () => {
    const deploy = read('.github/workflows/yandex-deploy.yml');
    expect(deploy).not.toContain('SUPABASE_DATABASE_URL');
    expect(deploy).not.toContain('ANNWORD_MIGRATION_SECRET');
  });

  it('keeps Vercel out of the Yandex deployment and operations chain', () => {
    const workflows = [
      '.github/workflows/yandex-deploy.yml',
      '.github/workflows/yandex-smoke.yml',
      '.github/workflows/production-operations.yml',
    ];
    const forbiddenRuntimeReferences = /VERCEL_|vercel\.app|api\.vercel\.com|\bvercel\s+(pull|build|deploy|promote)\b/i;
    const offenders = workflows.filter(path => forbiddenRuntimeReferences.test(read(path)));
    expect(offenders).toEqual([]);
  });

  it('does not keep repo-owned Vercel deployment, verification or deletion workflows', () => {
    const retiredWorkflows = [
      '.github/workflows/vercel-prebuilt-production.yml',
      '.github/workflows/vercel-production-verification.yml',
      '.github/workflows/vercel-promote-verified-preview.yml',
      '.github/workflows/retire-vercel-project-once.yml',
    ];
    expect(retiredWorkflows.filter(existsSync)).toEqual([]);
  });

  it('disables automatic Vercel Git deployments at the project configuration layer', () => {
    const config = JSON.parse(read('vercel.json')) as { git?: { deploymentEnabled?: boolean } };
    expect(config.git?.deploymentEnabled).toBe(false);
  });

  it('documents Yandex Cloud as the production source of truth', () => {
    const sourceOfTruth = read('docs/DEPLOYMENT_SOURCE_OF_TRUTH.md');
    expect(sourceOfTruth).toContain('AnnWord production is fully hosted in Yandex Cloud.');
    expect(sourceOfTruth).toContain('Supabase and Vercel are **not production runtime components**');
    expect(sourceOfTruth).toContain('Client production services must use the AnnWord backend API');
  });
});
