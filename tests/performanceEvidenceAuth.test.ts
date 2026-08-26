import { describe, expect, it } from 'vitest';
import {
  createPerformanceEvidenceSignature,
  performanceEvidenceSignatureInput,
  verifyPerformanceEvidenceSignature,
} from '../server/performanceEvidenceAuth';

const identity = {
  generatedAt: '2026-08-26T10:30:00.000Z',
  keepWarmStart: '2026-08-26T09:15:00Z',
  corsCutoff: '2026-08-24T10:35:35Z',
  corsWindowHours: 18,
};

const now = Date.parse('2026-08-26T10:35:00.000Z');

describe('performance evidence request signing', () => {
  it('uses a stable canonical identity and accepts the matching signature', () => {
    expect(performanceEvidenceSignatureInput(identity)).toBe(
      'annword-performance-evidence-v1|2026-08-26T10:30:00.000Z|2026-08-26T09:15:00Z|2026-08-24T10:35:35Z|18',
    );
    const signature = createPerformanceEvidenceSignature(identity, 'test-secret');
    expect(verifyPerformanceEvidenceSignature(identity, signature, 'test-secret', now)).toBe(true);
  });

  it('rejects tampering and requests outside the ten-minute replay window', () => {
    const signature = createPerformanceEvidenceSignature(identity, 'test-secret');
    expect(verifyPerformanceEvidenceSignature({ ...identity, corsWindowHours: 19 }, signature, 'test-secret', now)).toBe(false);
    expect(verifyPerformanceEvidenceSignature(identity, signature, 'wrong-secret', now)).toBe(false);
    expect(verifyPerformanceEvidenceSignature(identity, signature, 'test-secret', Date.parse('2026-08-26T10:41:01.000Z'))).toBe(false);
  });
});
