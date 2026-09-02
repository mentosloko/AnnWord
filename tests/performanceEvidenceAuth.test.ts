import { describe, expect, it } from 'vitest';
import {
  createPerformanceEvidenceSignature,
  performanceEvidenceSignatureInput,
  verifyPerformanceEvidenceSignature,
} from '../server/performanceEvidenceAuth';

const identity = {
  generatedAt: '2026-09-02T07:30:00.000Z',
  keepWarmStart: '2026-08-26T09:15:00Z',
  corsCutoff: '2026-08-24T10:35:35Z',
  corsWindowHours: 18,
  preparedBaselineStart: '2026-08-30T07:30:39Z',
  preparedInstanceStart: '2026-09-01T07:30:39Z',
  preparedWindowHours: 24,
};

const now = Date.parse('2026-09-02T07:35:00.000Z');

describe('performance evidence request signing', () => {
  it('uses a stable canonical identity and accepts the matching signature', () => {
    expect(performanceEvidenceSignatureInput(identity)).toBe(
      'annword-performance-evidence-v2|2026-09-02T07:30:00.000Z|2026-08-26T09:15:00Z|2026-08-24T10:35:35Z|18|2026-08-30T07:30:39Z|2026-09-01T07:30:39Z|24',
    );
    const signature = createPerformanceEvidenceSignature(identity, 'test-secret');
    expect(verifyPerformanceEvidenceSignature(identity, signature, 'test-secret', now)).toBe(true);
  });

  it('rejects tampering and requests outside the ten-minute replay window', () => {
    const signature = createPerformanceEvidenceSignature(identity, 'test-secret');
    expect(verifyPerformanceEvidenceSignature({ ...identity, preparedWindowHours: 25 }, signature, 'test-secret', now)).toBe(false);
    expect(verifyPerformanceEvidenceSignature(identity, signature, 'wrong-secret', now)).toBe(false);
    expect(verifyPerformanceEvidenceSignature(identity, signature, 'test-secret', Date.parse('2026-09-02T07:41:01.000Z'))).toBe(false);
  });
});
