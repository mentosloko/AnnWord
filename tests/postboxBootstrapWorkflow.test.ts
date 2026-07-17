import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/yandex-smoke.yml';
const workflow = readFileSync(workflowPath, 'utf8');

describe('Yandex post-cutover runtime smoke', () => {
  it('removes all one-time Postbox and DNS bootstrap workflows', () => {
    expect(existsSync('.github/workflows/postbox-byodkim-bootstrap.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-create-easy-dkim-diagnostic.yml')).toBe(false);
    expect(existsSync('.github/workflows/bootstrap-annword-postbox.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-bootstrap-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-write.yml')).toBe(false);
  });

  it('checks API, database, Postbox, security and frontend in separate observable sections', () => {
    expect(workflow).toContain('Check API, database and Postbox');
    expect(workflow).toContain('Check authorization and closed migration endpoints');
    expect(workflow).toContain('Check frontend routes and release marker');
    expect(workflow).toContain('id: api');
    expect(workflow).toContain('id: security');
    expect(workflow).toContain('id: frontend');
    expect(workflow.match(/continue-on-error: true/g)?.length).toBe(3);
    expect(workflow).toContain('Assert all runtime smoke sections passed');
  });

  it('keeps critical post-migration invariants under live verification', () => {
    expect(workflow).toContain('health.runtime !== \'yandex-cloud\'');
    expect(workflow).toContain('!db.database?.ok');
    expect(workflow).toContain('weekly.postboxIdentityVerified !== true');
    expect(workflow).toContain('test "$PROFILE_STATUS" = "401"');
    expect(workflow).toContain('test "$ADMIN_STATUS" = "401"');
    expect(workflow).toContain('test "$WEEKLY_RUN_STATUS" = "401"');
    expect(workflow).toContain('test "$MIGRATION_STATUS" = "404"');
    expect(workflow).toContain("release.sha !== process.env.SOURCE_SHA");
  });

  it('uploads sanitized diagnostics and phase markers on failure', () => {
    expect(workflow).toContain('name: annword-yandex-runtime-smoke');
    expect(workflow).toContain('/tmp/smoke-phase-*');
    expect(workflow).toContain('/tmp/annword-weekly-status.json');
    expect(workflow).toContain('/tmp/annword-release.json');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('context:"Yandex Runtime Smoke"');
  });
});
