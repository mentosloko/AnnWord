import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { applyDailyQuestResult, getOrCreateDailyQuest } from "../dailyQuestRepository";

export const dailyQuestRouter = Router();

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

dailyQuestRouter.post("/result", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await applyDailyQuestResult(req.user!.id, req.body || {});
    res.json(result);
  } catch (error) {
    console.error("Daily quest result failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Daily quest result failed" });
  }
});
