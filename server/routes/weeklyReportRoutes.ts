import { Router } from 'express';
import { inspectWeeklyReportRuntime } from '../weeklyReportRuntimeConfig';
import { runWeeklyReports } from '../weeklyReportService';

export const weeklyReportRouter = Router();

weeklyReportRouter.get('/status', async (_req, res) => {
  try {
    const runtime = await inspectWeeklyReportRuntime();
    res.status(runtime.configured ? 200 : 503).json({ status: runtime.configured ? 'ok' : 'error', ...runtime });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      configured: false,
      error: error instanceof Error ? error.message : 'Weekly report preflight failed',
    });
  }
});

weeklyReportRouter.post('/run', async (req, res) => {
  const expected = process.env.WEEKLY_REPORT_CRON_SECRET?.trim();
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const bodySecret = typeof req.body?.secret === 'string' ? req.body.secret.trim() : '';
  const authorized = Boolean(expected) && (authorization === `Bearer ${expected}` || bodySecret === expected);
  if (!authorized) {
    res.status(401).json({ code: 'unauthorized', error: 'Unauthorized' });
    return;
  }

  try {
    const runtime = await inspectWeeklyReportRuntime();
    if (!runtime.configured || runtime.postboxIdentityVerified !== true) {
      res.status(503).json({
        code: 'weekly_reports_not_configured',
        error: 'Yandex Postbox does not have a verified sending identity for weekly reports.',
        runtime,
      });
      return;
    }
    const result = await runWeeklyReports();
    res.status(result.failed.length ? 207 : 200).json(result);
  } catch (error) {
    console.error('Weekly report run failed', error);
    res.status(500).json({
      code: 'weekly_report_run_failed',
      error: error instanceof Error ? error.message : 'Weekly report run failed',
    });
  }
});
