import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import {
  claimDailyQuestSource,
  getLatestAuthoritativeQuestSource,
  isKidsAccount,
} from "../authoritativeGameResultRepository";
import { applyClassicResultIdempotently } from "../classicResultRepository";
import { applyDailyQuestResult, getOrCreateDailyQuest } from "../dailyQuestRepository";
import { reconcileProfileMood } from "../petMoodRepository";
import { rateLimit } from "../requestRateLimit";

export const dailyQuestRouter = Router();
const classicResultLimit = rateLimit({ scope: "game-mutation", max: 240, windowMs: 60_000 });

dailyQuestRouter.use(requireAuth);

dailyQuestRouter.get("/today", async (req: AuthenticatedRequest, res) => {
  try {
    const quest = await getOrCreateDailyQuest(req.user!.id);
    res.json({ quest });
  } catch (error) {
    console.error("Daily quest load failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Daily quest load failed" });
  }
});

dailyQuestRouter.post("/classic-result", classicResultLimit, async (req: AuthenticatedRequest, res) => {
  try {
    const operationId = typeof req.body?.operationId === "string" ? req.body.operationId.trim().slice(0, 160) : "";
    const word = typeof req.body?.word === "string" ? req.body.word.trim().toUpperCase() : "";
    if (!operationId || !word || !/^[A-Z]+$/.test(word)) {
      res.status(400).json({ error: "Некорректный результат Классики." });
      return;
    }

    const won = req.body?.won === true;
    const committed = await applyClassicResultIdempotently(req.user!.id, {
      operationId,
      word,
      won,
      coinsAdjustment: Number(req.body?.coinsAdjustment || 0),
    });
    const daily = await applyDailyQuestResult(req.user!.id, { type: "wordle", won });
    res.json({
      duplicate: committed.duplicate,
      quest: daily.quest,
      reward: daily.reward,
      profile: daily.profile || committed.profile,
    });
  } catch (error) {
    console.error("Classic result commit failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Classic result commit failed" });
  }
});

dailyQuestRouter.post("/result", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    if (!await isKidsAccount(userId)) {
      const result = await applyDailyQuestResult(userId, req.body || {});
      res.json(result);
      return;
    }

    const source = await getLatestAuthoritativeQuestSource(userId);
    if (!source) {
      res.status(409).json({ code: "authoritative_game_result_required", error: "Сначала сохраните результат игры." });
      return;
    }

    const accepted = await claimDailyQuestSource(userId, source.sourceEventKey);
    if (!accepted) {
      const [quest, profile] = await Promise.all([getOrCreateDailyQuest(userId), reconcileProfileMood(userId, true)]);
      res.json({ quest, reward: null, profile });
      return;
    }

    const result = await applyDailyQuestResult(userId, source.input);
    res.json(result);
  } catch (error) {
    console.error("Daily quest result failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Daily quest result failed" });
  }
});
