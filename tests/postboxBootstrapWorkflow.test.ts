import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deployWorkflow = readFileSync('.github/workflows/yandex-deploy.yml', 'utf8');

describe('Yandex post-cutover production checks', () => {
  it('removes all one-time Postbox and DNS bootstrap workflows', () => {
    expect(existsSync('.github/workflows/postbox-byodkim-bootstrap.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-create-easy-dkim-diagnostic.yml')).toBe(false);
    expect(existsSync('.github/workflows/bootstrap-annword-postbox.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-bootstrap-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-write.yml')).toBe(false);
  });

  it('keeps essential release health checks in the production deploy itself', () => {
    expect(deployWorkflow).toContain('Verify live Yandex production');
    expect(deployWorkflow).toContain('/api/health');
    expect(deployWorkflow).toContain('/api/health/db');
    expect(deployWorkflow).toContain('release.json?sha=${GITHUB_SHA}');
    expect(deployWorkflow).toContain('access-control-max-age');
    expect(deployWorkflow).toContain('context:"Yandex Production"');
  });

  it('retires GitHub-hosted production polling while keeping the product report scheduler', () => {
    expect(existsSync('.github/workflows/production-operations.yml')).toBe(false);
    expect(existsSync('.github/workflows/weekly-reports.yml')).toBe(true);
  });

  it('does not keep redundant post-deploy diagnostic workflows', () => {
    expect(existsSync('.github/workflows/yandex-smoke.yml')).toBe(false);
    expect(existsSync('.github/workflows/production-performance-evidence.yml')).toBe(false);
  });
});
