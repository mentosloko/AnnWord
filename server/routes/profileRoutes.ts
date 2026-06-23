import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { applyGameResult, getOrCreateProfile, syncProfileState, updateProfileDictionary, updateWeeklyReportEmail } from "../profileRepository";
import { listDictionaryCollections, saveDictionaryCollection } from "../dictionaryCollectionRepository";
import { assignedWordsRouter } from "./assignedWordsRoutes";

export const profileRouter = Router();

profileRouter.use(requireAuth);
profileRouter.use(assignedWordsRouter);

profileRouter.get("/me", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const profile = await getOrCreateProfile(user.id, user.name || user.email.split("@")[0] || "Пользователь");
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Profile load failed" });
  }
});

profileRouter.get("/dictionary-collections", async (req: AuthenticatedRequest, res) => {
  try {
    const collections = await listDictionaryCollections(req.user!.id);
    res.json({ collections });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Dictionary collections load failed" });
  }
});

profileRouter.post("/dictionary-collections", async (req: AuthenticatedRequest, res) => {
  try {
    const collection = await saveDictionaryCollection(req.user!.id, req.body || {});
    res.status(201).json({ collection });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Dictionary collection save failed" });
  }
});

profileRouter.patch("/dictionary", async (req: AuthenticatedRequest, res) => {
  try {
    const words = Array.isArray(req.body?.words) ? req.body.words.filter((item: unknown): item is string => typeof item === "string") : [];
    const profile = await updateProfileDictionary(req.user!.id, words);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Dictionary update failed" });
  }
});

profileRouter.patch("/weekly-report-email", async (req: AuthenticatedRequest, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const profile = await updateWeeklyReportEmail(req.user!.id, email);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Weekly email update failed" });
  }
});

profileRouter.post("/sync-state", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await syncProfileState(req.user!.id, {
      inventory: Array.isArray(req.body?.inventory) ? req.body.inventory : [],
      pet: req.body?.pet,
      coins: Number(req.body?.coins || 0),
    });
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Profile sync failed" });
  }
});

profileRouter.post("/game-result", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await applyGameResult(req.user!.id, req.body?.stats, req.body?.pet, Number(req.body?.coinsDelta || 0));
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Game result update failed" });
  }
});
