import { Router } from 'express';
import { runWeeklyReports } from '../weeklyReportService';

export const weeklyReportRouter = Router();

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
