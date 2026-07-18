import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/yandex-deploy.yml', 'utf8');

describe('Yandex production deployment workflow', () => {
  it('deploys pushes from main instead of the legacy migration branch', () => {
    expect(workflow).toContain('      - main');
    expect(workflow).not.toContain('      - infra/ru-cloud-migration');
  });

  it('runs database migrations before publishing every production revision', () => {
    const migrationStep = workflow.indexOf('Run Yandex PostgreSQL migrations');
    const imageStep = workflow.indexOf('Build and push backend image');
    expect(migrationStep).toBeGreaterThan(-1);
    expect(workflow).toContain('npm run db:yandex:migrate');
    expect(migrationStep).toBeLessThan(imageStep);
    expect(workflow).not.toContain("github.event_name == 'workflow_dispatch' && inputs.run_migrations == 'true'");
  });

  it('contains the complete backend and frontend publication sequence', () => {
    expect(workflow).toContain('Build and push backend image');
    expect(workflow).toContain('Deploy backend serverless container revision');
    expect(workflow).toContain('Upload frontend to Yandex Object Storage');
    expect(workflow).toContain('s3 sync dist');
  });

  it('verifies the exact live release and rejects foreign registration emails', () => {
    expect(workflow).toContain('dist/release.json');
    expect(workflow).toContain('Verify live Yandex production');
    expect(workflow).toContain('russian_email_domain_required');
    expect(workflow).toContain('/api/auth/email/account');
    expect(workflow).toContain('Yandex Production');
  });
});
