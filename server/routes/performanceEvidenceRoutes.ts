import { Router } from 'express';
import { readRequiredEnv } from '../config';
import { verifyPerformanceEvidenceSignature } from '../performanceEvidenceAuth';
import { readPerformanceRumEvidence } from '../performanceEvidenceRepository';

export const performanceEvidenceRouter = Router();

const readQueryText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const PREPARED_BASELINE_START = '2026-08-30T07:30:39Z';
const PREPARED_INSTANCE_START = '2026-09-01T07:30:39Z';
const PREPARED_WINDOW_HOURS = 24;

performanceEvidenceRouter.get('/internal/performance-evidence', async (req, res) => {
  const generatedAt = readQueryText(req.query.generatedAt);
  const keepWarmStart = readQueryText(req.query.keepWarmStart);
  const corsCutoff = readQueryText(req.query.corsCutoff);
  const rawWindowHours = Number.parseInt(readQueryText(req.query.corsWindowHours), 10);
  const corsWindowHours = Number.isFinite(rawWindowHours) ? rawWindowHours : 18;
  const identity = { generatedAt, keepWarmStart, corsCutoff, corsWindowHours };
  const signature = readQueryText(req.headers['x-annword-evidence-signature']);

  try {
    if (!verifyPerformanceEvidenceSignature(identity, signature, readRequiredEnv('JWT_SECRET'))) {
      res.status(401).json({ code: 'performance_evidence_unauthorized', error: 'Unauthorized' });
      return;
    }
    const evidence = await readPerformanceRumEvidence({
      ...identity,
      preparedBaselineStart: PREPARED_BASELINE_START,
      preparedInstanceStart: PREPARED_INSTANCE_START,
      preparedWindowHours: PREPARED_WINDOW_HOURS,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(evidence);
  } catch (error) {
    console.error('Performance evidence aggregation failed', error);
    res.status(500).json({ code: 'performance_evidence_failed', error: 'Performance evidence aggregation failed' });
  }
});
