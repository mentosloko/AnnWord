import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');
const retiredProvider = ['supa', 'base'].join('');

describe('Yandex-only production contract', () => {
  it('keeps the retired database provider out of the checked-in tree', () => {
    const grep = spawnSync('git', ['grep', '-I', '-n', '-i', retiredProvider, '--', '.'], { encoding: 'utf8' });
    const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
    expect(grep.status, grep.stdout || grep.stderr).toBe(1);
    expect(tracked.status, tracked.stderr).toBe(0);
    const matchingPaths = tracked.stdout
      .split('\n')
      .filter(Boolean)
      .filter(path => path.toLowerCase().includes(retiredProvider));
    expect(matchingPaths).toEqual([]);
  });

  it('does not keep obsolete provider development/runtime entrypoints', () => {
    expect(existsSync('server.ts')).toBe(false);
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.server).toBeUndefined();
    expect(existsSync('server/routes/migrationRoutes.ts')).toBe(false);
    expect(existsSync('server/routes/migrationSchemaRoutes.ts')).toBe(false);
  });

  it('does not keep the legacy Vercel serverless API tree', () => {
    expect(existsSync('api')).toBe(false);
    expect(existsSync('services/premiumPlanCatalog.ts')).toBe(true);
  });

  it('does not install retired provider or Firebase packages', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      engines?: { node?: string };
    };
    const dependencies = packageJson.dependencies || {};
    expect(dependencies[`@${retiredProvider}/${retiredProvider}-js`]).toBeUndefined();
    expect(dependencies.firebase).toBeUndefined();
    expect(dependencies['firebase-admin']).toBeUndefined();
    expect(packageJson.engines?.node).toBe('>=22');

    const lockfile = read('package-lock.json').toLowerCase();
    expect(lockfile).not.toContain(`node_modules/@${retiredProvider}/`);
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

  it('keeps retired migration secrets out of the Yandex production deploy', () => {
    const deploy = read('.github/workflows/yandex-deploy.yml').toUpperCase();
    expect(deploy).not.toContain(`${retiredProvider.toUpperCase()}_DATABASE_URL`);
    expect(deploy).not.toContain('ANNWORD_MIGRATION_SECRET');
  });

  it('keeps Vercel out of the Yandex deployment chain', () => {
    const deploy = read('.github/workflows/yandex-deploy.yml');
    const forbiddenRuntimeReferences = /VERCEL_|vercel\.app|api\.vercel\.com|\bvercel\s+(pull|build|deploy|promote)\b/i;
    expect(forbiddenRuntimeReferences.test(deploy)).toBe(false);
  });

  it('does not keep retired deployment and diagnostic workflows', () => {
    const retiredFiles = [
      '.github/workflows/vercel-prebuilt-production.yml',
      '.github/workflows/vercel-production-verification.yml',
      '.github/workflows/vercel-promote-verified-preview.yml',
      '.github/workflows/retire-vercel-project-once.yml',
      '.github/workflows/yandex-smoke.yml',
      '.github/workflows/production-performance-evidence.yml',
      '.github/workflows/production-operations.yml',
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
    expect(readme).not.toContain('every push to `main` should create a new production deployment');
    expect(envExample).toContain('VITE_API_URL=http://localhost:8080');
    expect(envExample.toLowerCase()).not.toContain(retiredProvider);
  });

  it('documents Yandex Cloud as the production source of truth', () => {
    const sourceOfTruth = read('docs/DEPLOYMENT_SOURCE_OF_TRUTH.md');
    expect(sourceOfTruth).toContain('AnnWord production is fully hosted in Yandex Cloud.');
    expect(sourceOfTruth).toContain('Client production services must use the AnnWord backend API');
    expect(sourceOfTruth).toContain('Historical migration tooling is not part of the active repository');
  });
});
