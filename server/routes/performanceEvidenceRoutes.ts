import { Router } from 'express';
import { readRequiredEnv } from '../config';
import { verifyPerformanceEvidenceSignature } from '../performanceEvidenceAuth';
import { readPerformanceRumEvidence } from '../performanceEvidenceRepository';

export const performanceEvidenceRouter = Router();

const readQueryText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

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
    const evidence = await readPerformanceRumEvidence(identity);
    res.setHeader('Cache-Control', 'no-store');
    res.json(evidence);
  } catch (error) {
    console.error('Performance evidence aggregation failed', error);
    res.status(500).json({ code: 'performance_evidence_failed', error: 'Performance evidence aggregation failed' });
  }
});
