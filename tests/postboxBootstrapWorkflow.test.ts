import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/postbox-create-easy-dkim-diagnostic.yml';
const workflow = readFileSync(workflowPath, 'utf8');

describe('Yandex Postbox bootstrap', () => {
  it('uses deterministic BYODKIM after Easy DKIM target discovery proved incomplete', () => {
    expect(existsSync('.github/workflows/bootstrap-annword-postbox.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-bootstrap-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-write.yml')).toBe(false);
    expect(workflow).toContain("requiredRoles: ['postbox.editor', 'dns.editor']");
    expect(workflow).toContain("SELECTOR='annword-postbox'");
    expect(workflow).toContain('DomainSigningSelector');
    expect(workflow).toContain('DomainSigningPrivateKey');
    expect(workflow).toContain('v=DKIM1;h=sha256;k=rsa;p=');
    expect(workflow).toContain('TXT');
    expect(workflow).toContain('openssl genrsa');
    expect(workflow).toContain('context:"Yandex Postbox Bootstrap"');
    expect(workflow).not.toContain('dkim.amazonses.com.');
    expect(workflow).not.toContain('SigningHostedZone');
  });

  it('installs the public key before creating the address and removes private material', () => {
    const dnsWrite = workflow.indexOf('dns zone replace-records');
    const identityCreate = workflow.indexOf('--data-binary @/tmp/create-request.json');
    expect(dnsWrite).toBeGreaterThan(-1);
    expect(identityCreate).toBeGreaterThan(dnsWrite);
    expect(workflow).toContain('rm -f \\');
    expect(workflow).toContain('/tmp/annword-dkim-private.pem');
    expect(workflow).toContain('Assert no DKIM private material remains');
    expect(workflow).not.toContain('/tmp/annword-dkim-private.pem\n            /tmp/identity');
  });

  it('keeps failures observable and never treats an unverified sender as success', () => {
    expect(workflow).toContain('/tmp/postbox-iam-result.json');
    expect(workflow).toContain('/tmp/byodkim-summary.json');
    expect(workflow).toContain('postboxIdentityVerified===true');
    expect(workflow).toContain('VerificationStatus');
    expect(workflow).toContain('VerifiedForSendingStatus');
    expect(workflow).toContain('if [ "$JOB_STATUS" = "success" ]');
  });
});
