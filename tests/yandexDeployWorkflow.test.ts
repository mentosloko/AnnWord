import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/yandex-deploy.yml', 'utf8');

describe('Yandex production deployment workflow', () => {
  it('deploys pushes from main instead of the legacy migration branch', () => {
    expect(workflow).toContain('      - main');
    expect(workflow).not.toContain('      - infra/ru-cloud-migration');
  });

  it('runs database migrations for production pushes', () => {
    expect(workflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
  });
});
