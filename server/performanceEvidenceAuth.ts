import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PerformanceEvidenceRequestIdentity {
  generatedAt: string;
  keepWarmStart: string;
  corsCutoff: string;
  corsWindowHours: number;
}

const MAX_REQUEST_AGE_MS = 10 * 60 * 1000;

export function performanceEvidenceSignatureInput(identity: PerformanceEvidenceRequestIdentity): string {
  return [
    'annword-performance-evidence-v1',
    identity.generatedAt,
    identity.keepWarmStart,
    identity.corsCutoff,
    String(identity.corsWindowHours),
  ].join('|');
}

export function createPerformanceEvidenceSignature(identity: PerformanceEvidenceRequestIdentity, secret: string): string {
  return createHmac('sha256', secret).update(performanceEvidenceSignatureInput(identity)).digest('hex');
}

export function verifyPerformanceEvidenceSignature(
  identity: PerformanceEvidenceRequestIdentity,
  signature: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const generatedAtMs = Date.parse(identity.generatedAt);
  if (!Number.isFinite(generatedAtMs) || Math.abs(nowMs - generatedAtMs) > MAX_REQUEST_AGE_MS) return false;
  if (!signature || !secret) return false;
  const expected = createPerformanceEvidenceSignature(identity, secret);
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
