import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/postbox-create-easy-dkim-diagnostic.yml';
const workflow = readFileSync(workflowPath, 'utf8');

describe('Yandex Postbox bootstrap', () => {
  it('uses Easy DKIM without handling private keys', () => {
    expect(existsSync('.github/workflows/bootstrap-annword-postbox.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-bootstrap-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-write.yml')).toBe(false);
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

  it('recreates only a terminal FAILED identity before installing its current DNS records', () => {
    expect(workflow).toContain("if [ \"$STATUS\" = \"FAILED\" ]");
    expect(workflow).toContain('Removing terminal FAILED identity before a clean verification cycle.');
    expect(workflow).toContain('-X DELETE');
    expect(workflow).toContain('SHOULD_CREATE=true');
    expect(workflow).toContain("printf '%s' 'recreated' > /tmp/identity-source");
    expect(workflow).not.toContain('Restart failed Postbox verification');
    expect(workflow).not.toContain('SigningEnabled');
  });

  it('keeps failures observable and never treats an unverified sender as success', () => {
    expect(workflow).toContain('/tmp/postbox-iam-result.json');
    expect(workflow).toContain('postboxIdentityVerified===true');
    expect(workflow).toContain('VerificationStatus');
    expect(workflow).toContain('VerifiedForSendingStatus');
    expect(workflow).toContain('if [ "$JOB_STATUS" = "success" ]');
  });
});
