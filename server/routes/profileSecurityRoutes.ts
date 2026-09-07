import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import {
  applyAuthoritativeGameResult,
  extractClientRewardClaim,
  isKidsAccount,
  updateCharacterIdentityServerAuthoritative,
  updateKidsWordStatsWithoutGameCounters,
} from '../authoritativeGameResultRepository';
import { reconcileProfileMood, syncProfileStateServerAuthoritative } from '../petMoodRepository';

export const profileSecurityRouter = Router();

profileSecurityRouter.post('/coins', (req: AuthenticatedRequest, res, next) => {
  const amount = Number(req.body?.amount ?? 0);
  if (!Number.isFinite(amount)) {
    res.status(400).json({ code: 'invalid_coin_delta', error: 'Некорректное изменение баланса.' });
    return;
  }
  if (amount > 0) {
    res.status(403).json({ code: 'direct_coin_credit_forbidden', error: 'Игровые монеты начисляются только сервером по результату игры.' });
    return;
  }
  next();
});

profileSecurityRouter.patch('/pet', async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await updateCharacterIdentityServerAuthoritative(req.user!.id, req.body?.pet);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: 'pet_update_failed', error: error instanceof Error ? error.message : 'Pet update failed' });
  }
});

profileSecurityRouter.patch('/stats', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!await isKidsAccount(req.user!.id)) {
      next();
      return;
    }
    const profile = await updateKidsWordStatsWithoutGameCounters(req.user!.id, req.body?.stats);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: 'stats_update_failed', error: error instanceof Error ? error.message : 'Stats update failed' });
  }
});

profileSecurityRouter.post('/sync-state', async (req: AuthenticatedRequest, res) => {
  try {
    const current = await reconcileProfileMood(req.user!.id);
    const profile = await syncProfileStateServerAuthoritative(
      req.user!.id,
      current.pet,
      Array.isArray(req.body?.inventory) ? req.body.inventory : current.inventory,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: 'profile_sync_failed', error: error instanceof Error ? error.message : 'Profile sync failed' });
  }
});

profileSecurityRouter.post('/game-result', async (req: AuthenticatedRequest, res) => {
  try {
    const claim = extractClientRewardClaim(req.body?.gameEvents);
    if (!claim) {
      const noValueBenchmarkProbe = Number(req.body?.coinsDelta || 0) === 0
        && Array.isArray(req.body?.gameEvents)
        && req.body.gameEvents.length === 0
        && (!Array.isArray(req.body?.analyticsEvents) || req.body.analyticsEvents.length === 0);
      if (noValueBenchmarkProbe) {
        const profile = await reconcileProfileMood(req.user!.id);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ profile, duplicate: false, probe: true });
        return;
      }
      res.status(400).json({ code: 'authoritative_reward_claim_required', error: 'Результат игры не содержит защищённый идентификатор награды.' });
      return;
    }

    const result = await applyAuthoritativeGameResult(
      req.user!.id,
      claim,
      req.body?.analyticsEvents,
      req.body?.gameEvents,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ profile: result.profile, duplicate: result.duplicate });
  } catch (error) {
    res.status(400).json({ code: 'game_result_update_failed', error: error instanceof Error ? error.message : 'Game result failed' });
  }
});
