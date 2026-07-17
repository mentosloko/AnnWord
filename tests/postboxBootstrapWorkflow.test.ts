import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/postbox-byodkim-bootstrap.yml';
const workflow = readFileSync(workflowPath, 'utf8');

describe('Yandex Postbox bootstrap', () => {
  it('uses deterministic BYODKIM with explicit DER formats', () => {
    expect(existsSync('.github/workflows/postbox-create-easy-dkim-diagnostic.yml')).toBe(false);
    expect(existsSync('.github/workflows/bootstrap-annword-postbox.yml')).toBe(false);
    expect(existsSync('.github/workflows/postbox-bootstrap-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-status.yml')).toBe(false);
    expect(existsSync('.github/workflows/diagnose-postbox-dns-write.yml')).toBe(false);
    expect(workflow).toContain("requiredRoles: ['postbox.editor', 'dns.editor']");
    expect(workflow).toContain("SELECTOR='annword-postbox'");
    expect(workflow).toContain("generateKeyPairSync('rsa'");
    expect(workflow).toContain("publicKeyEncoding: { type: 'spki', format: 'der' }");
    expect(workflow).toContain("privateKeyEncoding: { type: 'pkcs8', format: 'der' }");
    expect(workflow).toContain('DomainSigningSelector');
    expect(workflow).toContain('DomainSigningPrivateKey');
    expect(workflow).toContain('v=DKIM1;h=sha256;k=rsa;p=');
    expect(workflow).toContain('recordValue.length > 255');
    expect(workflow).toContain('context:"Yandex Postbox Bootstrap"');
    expect(workflow).not.toContain('openssl genrsa');
    expect(workflow).not.toContain('dkim.amazonses.com.');
    expect(workflow).not.toContain('SigningHostedZone');
  });

  it('installs the public key before creating the identity and removes private material on every exit', () => {
    const dnsWrite = workflow.indexOf('dns zone replace-records');
    const identityCreate = workflow.indexOf('--data-binary @/tmp/create-request.json');
    expect(dnsWrite).toBeGreaterThan(-1);
    expect(identityCreate).toBeGreaterThan(dnsWrite);
    expect(workflow).toContain('trap cleanup_private_material EXIT');
    expect(workflow).toContain('/tmp/annword-dkim-private.b64');
    expect(workflow).toContain('Assert no DKIM private material remains');
    const artifactStart = workflow.indexOf('Upload sanitized bootstrap result');
    const artifactEnd = workflow.indexOf('Assert no DKIM private material remains');
    const artifactBlock = workflow.slice(artifactStart, artifactEnd);
    expect(artifactBlock).not.toContain('/tmp/annword-dkim-private.b64');
    expect(artifactBlock).not.toContain('/tmp/create-request.json');
  });

  it('records the last safe phase and external response codes', () => {
    expect(workflow).toContain('/tmp/bootstrap-phase');
    expect(workflow).toContain('/tmp/dkim-generation-summary.json');
    expect(workflow).toContain('/tmp/dns-write-code');
    expect(workflow).toContain('/tmp/dns-write-output');
    expect(workflow).toContain('/tmp/create-http-code');
    expect(workflow).toContain('/tmp/create-response.json');
    expect(workflow).toContain('/tmp/postbox-iam-result.json');
    expect(workflow).toContain('/tmp/byodkim-summary.json');
    expect(workflow).toContain('postboxIdentityVerified===true');
    expect(workflow).toContain('VerificationStatus');
    expect(workflow).toContain('VerifiedForSendingStatus');
    expect(workflow).toContain('if [ "$JOB_STATUS" = "success" ]');
  });
});
