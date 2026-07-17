import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/bootstrap-annword-postbox.yml', 'utf8');

describe('Postbox bootstrap observability', () => {
  it('publishes a commit status and records sanitized DNS and identity diagnostics', () => {
    expect(workflow).toContain('statuses: write');
    expect(workflow).toContain('context:"Yandex Postbox Bootstrap"');
    expect(workflow).toContain('list-records --id');
    expect(workflow).toContain('VerificationStatus');
    expect(workflow).toContain('SendingEnabled');
    expect(workflow).not.toContain('cat /tmp/create-identity.json');
    expect(workflow).not.toContain('cat /tmp/annword-dkim-private.pem');
  });
});
