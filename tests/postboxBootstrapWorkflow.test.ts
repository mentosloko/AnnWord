import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/postbox-create-easy-dkim-diagnostic.yml';
const workflow = readFileSync(workflowPath, 'utf8');

describe('Yandex Postbox bootstrap', () => {
  it('uses least-privilege IAM and Easy DKIM without handling private keys', () => {
    expect(existsSync('.github/workflows/bootstrap-annword-postbox.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-bootstrap-status.yml')).toBe(false);
    expect(workflow).toContain("requiredRole: 'postbox.editor'");
    expect(workflow).toContain("'{\"EmailIdentity\":\"annword.ru\"}'");
    expect(workflow).toContain('DkimAttributes');
    expect(workflow).toContain('Tokens');
    expect(workflow).toContain('CNAME');
    expect(workflow).toContain('dkim.amazonses.com.');
    expect(workflow).toContain('context:"Yandex Postbox Bootstrap"');
    expect(workflow).not.toContain('SigningHostedZone');
    expect(workflow).not.toContain('DomainSigningPrivateKey');
    expect(workflow).not.toContain('openssl genpkey');
  });

  it('keeps failures observable and never treats an unverified sender as success', () => {
    expect(workflow).toContain('/tmp/postbox-iam-result.json');
    expect(workflow).toContain('postboxIdentityVerified===true');
    expect(workflow).toContain('VerificationStatus');
    expect(workflow).toContain('SendingEnabled');
    expect(workflow).toContain('if [ "$JOB_STATUS" = "success" ]');
  });
});
