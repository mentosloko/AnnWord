import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { requireAuth } from '../auth';
import { insertGameEvents } from '../activityEventRepository';

export const gameEventRouter = Router();
gameEventRouter.use(requireAuth);

gameEventRouter.post('/events', async (req: AuthenticatedRequest, res) => {
  try {
    const inserted = await insertGameEvents(req.user!.id, req.body?.events ?? req.body, 100);
    res.json({ ok: true, inserted });
  } catch (error) {
    console.error('Game events write failed', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Game events write failed' });
  }
});
