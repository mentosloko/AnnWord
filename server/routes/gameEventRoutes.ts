import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { requireAuth } from '../auth';
import { insertGameEvents } from '../activityEventRepository';

export const gameEventRouter = Router();
gameEventRouter.use(requireAuth);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sanitizeClientEvents = (raw: unknown): Record<string, unknown>[] => (Array.isArray(raw) ? raw : [])
  .filter(isRecord)
  .filter(event => {
    const key = typeof (event.eventKey ?? event.event_key) === 'string' ? String(event.eventKey ?? event.event_key) : '';
    return !key.startsWith('authoritative:') && !key.startsWith('daily-quest:');
  })
  .map(event => ({ ...event, coinsDelta: 0, coins_delta: 0, xpDelta: 0, xp_delta: 0 }));

gameEventRouter.post('/events', async (req: AuthenticatedRequest, res) => {
  try {
    const inserted = await insertGameEvents(req.user!.id, sanitizeClientEvents(req.body?.events ?? req.body), 100);
    res.json({ ok: true, inserted });
  } catch (error) {
    console.error('Game events write failed', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Game events write failed' });
  }
});
