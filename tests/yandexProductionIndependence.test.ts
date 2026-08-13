import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');

const serviceFiles = (): string[] => readdirSync('services', { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
  .map(entry => `services/${entry.name}`);

describe('Yandex-only production contract', () => {
  it('keeps Supabase out of the client runtime', () => {
    const offenders = serviceFiles().filter(path => /from\s+['"]\.\.\/supabase['"]|from\s+['"]\.\/supabase['"]/.test(read(path)));
    expect(offenders).toEqual([]);
    expect(read('hooks/useAuthProfile.ts')).not.toContain('@supabase/supabase-js');
    expect(existsSync('services/petMoodClock.ts')).toBe(false);
    expect(existsSync('supabase.ts')).toBe(false);
  });

  it('does not keep the obsolete Supabase development server', () => {
    expect(existsSync('server.ts')).toBe(false);
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.server).toBeUndefined();
  });

  it('does not keep the legacy Vercel serverless API tree', () => {
    expect(existsSync('api')).toBe(false);
    expect(existsSync('services/premiumPlanCatalog.ts')).toBe(true);
  });

  it('does not install legacy Supabase or Firebase packages', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      engines?: { node?: string };
    };
    const dependencies = packageJson.dependencies || {};
    expect(dependencies['@supabase/supabase-js']).toBeUndefined();
    expect(dependencies.firebase).toBeUndefined();
    expect(dependencies['firebase-admin']).toBeUndefined();
    expect(packageJson.engines?.node).toBe('>=22');

    const lockfile = read('package-lock.json');
    expect(lockfile).not.toContain('node_modules/@supabase/');
    expect(lockfile).not.toContain('node_modules/firebase"');
    expect(lockfile).not.toContain('node_modules/firebase-admin"');
  });

  it('runs the application, PR checks and Yandex production build on Node 22', () => {
    const dockerfile = read('Dockerfile.api');
    const prCheck = read('.github/workflows/pr-check.yml');
    const yandexDeploy = read('.github/workflows/yandex-deploy.yml');
    expect(dockerfile).toContain('FROM node:22-alpine');
    expect(prCheck).toContain("node-version: '22'");
    expect(prCheck).not.toContain("node-version: '20'");
    expect(yandexDeploy).toContain('NODE_VERSION: "22"');
    expect(yandexDeploy).not.toContain('NODE_VERSION: "20"');
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

  it('does not keep repo-owned Vercel workflows or redeploy trigger files', () => {
    const retiredFiles = [
      '.github/workflows/vercel-prebuilt-production.yml',
      '.github/workflows/vercel-production-verification.yml',
      '.github/workflows/vercel-promote-verified-preview.yml',
      '.github/workflows/retire-vercel-project-once.yml',
      '.production-redeploy-memory-hotfix',
      '.runtime-hotfix-trigger',
      '.vercel-force-redeploy-20260719',
      '.vercel-preview-trigger',
      '.vercel-production-retry',
      '.vercel-redeploy',
    ];
    expect(retiredFiles.filter(existsSync)).toEqual([]);
  });

  it('disables automatic Vercel Git deployments at the project configuration layer', () => {
    const config = JSON.parse(read('vercel.json')) as { git?: { deploymentEnabled?: boolean } };
    expect(config.git?.deploymentEnabled).toBe(false);
  });

  it('keeps developer docs aligned with the Yandex architecture', () => {
    const readme = read('README.md');
    const envExample = read('.env.example');
    expect(readme).toContain('AnnWord production is fully hosted in Yandex Cloud');
    expect(readme).not.toContain('Supabase-backed user profiles');
    expect(readme).not.toContain('every push to `main` should create a new production deployment');
    expect(envExample).toContain('VITE_API_URL=http://localhost:8080');
    expect(envExample).not.toContain('VITE_SUPABASE_URL');
    expect(envExample).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('documents Yandex Cloud as the production source of truth', () => {
    const sourceOfTruth = read('docs/DEPLOYMENT_SOURCE_OF_TRUTH.md');
    expect(sourceOfTruth).toContain('AnnWord production is fully hosted in Yandex Cloud.');
    expect(sourceOfTruth).toContain('Supabase and Vercel are **not production runtime components**');
    expect(sourceOfTruth).toContain('Client production services must use the AnnWord backend API');
  });
});
