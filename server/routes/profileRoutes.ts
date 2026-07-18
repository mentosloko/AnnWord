import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { applyGameResult, getOrCreateProfile, incrementProfileCoins, updateProfileDictionary, updateProfilePet, updateProfileStats } from "../profileRepository";
import { reconcileProfileMood, syncProfileStateServerAuthoritative, useProfileItemServerAuthoritative } from "../petMoodRepository";
import { getWeeklyReportPreferenceStatus, updateWeeklyReportEmailPreference } from "../weeklyReportProfileRepository";
import { listDictionaryCollections, saveDictionaryCollection } from "../dictionaryCollectionRepository";
import { purchaseProfileItem } from "../purchaseRepository";
import { assignedWordsRouter } from "./assignedWordsRoutes";

export const profileRouter = Router();

profileRouter.use(requireAuth);
profileRouter.use(assignedWordsRouter);

profileRouter.get("/me", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ code: "unauthorized", error: "Unauthorized" });
      return;
    }
    await getOrCreateProfile(user.id, user.name || user.email.split("@")[0] || "Пользователь");
    const profile = await reconcileProfileMood(user.id);
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ code: "profile_load_failed", error: error instanceof Error ? error.message : "Profile load failed" });
  }
});

profileRouter.get("/dictionary-collections", async (req: AuthenticatedRequest, res) => {
  try {
    const collections = await listDictionaryCollections(req.user!.id);
    res.json({ collections });
  } catch (error) {
    res.status(400).json({ code: "dictionary_collections_load_failed", error: error instanceof Error ? error.message : "Dictionary collections load failed" });
  }
});

profileRouter.post("/dictionary-collections", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await saveDictionaryCollection(req.user!.id, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ code: "dictionary_collection_save_failed", error: error instanceof Error ? error.message : "Dictionary collection save failed" });
  }
});

profileRouter.patch("/dictionary", async (req: AuthenticatedRequest, res) => {
  try {
    const words = Array.isArray(req.body?.words) ? req.body.words.filter((item: unknown): item is string => typeof item === "string") : [];
    await updateProfileDictionary(req.user!.id, words);
    const profile = await reconcileProfileMood(req.user!.id);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "dictionary_update_failed", error: error instanceof Error ? error.message : "Dictionary update failed" });
  }
});

profileRouter.patch("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    await updateProfileStats(req.user!.id, req.body?.stats);
    const profile = await reconcileProfileMood(req.user!.id);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "stats_update_failed", error: error instanceof Error ? error.message : "Stats update failed" });
  }
});

profileRouter.patch("/pet", async (req: AuthenticatedRequest, res) => {
  try {
    await updateProfilePet(req.user!.id, req.body?.pet);
    const profile = await reconcileProfileMood(req.user!.id);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "pet_update_failed", error: error instanceof Error ? error.message : "Pet update failed" });
  }
});

profileRouter.post("/coins", async (req: AuthenticatedRequest, res) => {
  try {
    await incrementProfileCoins(req.user!.id, Number(req.body?.amount || 0));
    const profile = await reconcileProfileMood(req.user!.id);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "coins_update_failed", error: error instanceof Error ? error.message : "Coins update failed" });
  }
});

profileRouter.post("/purchase", async (req: AuthenticatedRequest, res) => {
  try {
    const itemId = typeof req.body?.itemId === "string" ? req.body.itemId.trim() : "";
    if (!itemId) {
      res.status(400).json({ code: "item_required", error: "Не выбран товар." });
      return;
    }
    await purchaseProfileItem(req.user!.id, itemId);
    const profile = await reconcileProfileMood(req.user!.id);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "purchase_failed", error: error instanceof Error ? error.message : "Покупка не удалась." });
  }
});

profileRouter.post("/use-item", async (req: AuthenticatedRequest, res) => {
  try {
    const itemId = typeof req.body?.itemId === "string" ? req.body.itemId.trim() : "";
    if (!itemId) {
      res.status(400).json({ code: "item_required", error: "Не выбран предмет." });
      return;
    }
    const profile = await useProfileItemServerAuthoritative(req.user!.id, itemId);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "item_use_failed", error: error instanceof Error ? error.message : "Предмет не удалось использовать." });
  }
});

profileRouter.get("/weekly-report-email/status", async (req: AuthenticatedRequest, res) => {
  try {
    const status = await getWeeklyReportPreferenceStatus(req.user!.id);
    res.json(status);
  } catch (error) {
    res.status(400).json({ code: "weekly_email_status_failed", error: error instanceof Error ? error.message : "Weekly email status failed" });
  }
});

profileRouter.patch("/weekly-report-email", async (req: AuthenticatedRequest, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    await updateWeeklyReportEmailPreference(req.user!.id, email);
    const profile = await reconcileProfileMood(req.user!.id);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "weekly_email_update_failed", error: error instanceof Error ? error.message : "Weekly email update failed" });
  }
});

profileRouter.post("/sync-state", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await syncProfileStateServerAuthoritative(
      req.user!.id,
      req.body?.pet,
      Array.isArray(req.body?.inventory) ? req.body.inventory : [],
    );
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "profile_sync_failed", error: error instanceof Error ? error.message : "Profile sync failed" });
  }
});

profileRouter.post("/game-result", async (req: AuthenticatedRequest, res) => {
  try {
    await applyGameResult(req.user!.id, req.body?.stats, req.body?.pet, Number(req.body?.coinsDelta || 0));
    const profile = await reconcileProfileMood(req.user!.id, true);
    res.json({ profile });
  } catch (error) {
    res.status(400).json({ code: "game_result_update_failed", error: error instanceof Error ? error.message : "Game result update failed" });
  }
});
