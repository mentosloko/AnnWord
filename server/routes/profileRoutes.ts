import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";
import { applyGameResult, getOrCreateProfile, incrementProfileCoins, updateProfileDictionary, updateProfilePet, updateProfileStats } from "../profileRepository";
import { reconcileProfileMood, syncProfileStateServerAuthoritative, useProfileItemServerAuthoritative } from "../petMoodRepository";
import { updateWeeklyReportEmailPreference } from "../weeklyReportProfileRepository";
import { listDictionaryCollections, saveDictionaryCollection } from "../dictionaryCollectionRepository";
import { purchaseProfileItem } from "../purchaseRepository";
import { assignedWordsRouter } from "./assignedWordsRoutes";

export const profileRouter = Router();

const readDiagnosticSecret = (req: Request): string => {
  const value = req.headers["x-annword-diagnostic-secret"];
  return typeof value === "string" ? value : "";
};

const isDiagnosticAuthorized = (req: Request): boolean => {
  const rootSecret = process.env.JWT_SECRET || "";
  const userId = String(req.params.userId || "").trim();
  const actual = readDiagnosticSecret(req);
  if (!rootSecret || !userId || !actual) return false;
  const expected = createHmac("sha256", rootSecret).update(`pet-mood-diagnostic:${userId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
};

const safeAggregate = async <T extends Record<string, unknown>>(sql: string, userId: string): Promise<T | null> => {
  try {
    const result = await query<T>(sql, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.warn("Optional pet diagnostic query failed", error);
    return null;
  }
};

profileRouter.get("/internal-diagnostic/pet-mood/:userId", async (req, res) => {
  if (!isDiagnosticAuthorized(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const userId = String(req.params.userId || "").trim();
    await reconcileProfileMood(userId);
    const profileResult = await query<{
      id: string;
      username: string;
      role: string | null;
      account_mode: string | null;
      subscription_tier: string | null;
      pet: Record<string, unknown> | null;
      stats: Record<string, unknown> | null;
      created_at: string | Date | null;
      updated_at: string | Date | null;
    }>(
      `select id, username, role, account_mode, subscription_tier, pet, stats, created_at, updated_at
         from profiles
        where id = $1`,
      [userId],
    );
    const profile = profileResult.rows[0];
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const account = await safeAggregate<{
      id: string;
      email: string;
      created_at: string | Date | null;
      updated_at: string | Date | null;
    }>("select id, email, created_at, updated_at from app_users where id = $1", userId);
    const gameEvents = await safeAggregate<{ count: number; last_occurred_at: string | Date | null }>(
      "select count(*)::int as count, max(occurred_at) as last_occurred_at from game_events where user_id = $1",
      userId,
    );
    const analyticsEvents = await safeAggregate<{ count: number; last_occurred_at: string | Date | null }>(
      "select count(*)::int as count, max(occurred_at) as last_occurred_at from analytics_events where user_id = $1",
      userId,
    );
    const dailyQuest = await safeAggregate<{
      quest_date: string | Date | null;
      completed: boolean;
      completed_at: string | Date | null;
      updated_at: string | Date | null;
    }>(
      `select quest_date, completed, completed_at, updated_at
         from daily_quests
        where user_id = $1
        order by quest_date desc
        limit 1`,
      userId,
    );

    const pet = profile.pet || {};
    const lastDailyActivityDate = typeof pet.lastDailyActivityDate === "string" ? pet.lastDailyActivityDate : null;
    const moodUpdatedAt = typeof pet.moodUpdatedAt === "string" ? pet.moodUpdatedAt : null;
    const moodUpdatedMs = moodUpdatedAt ? Date.parse(moodUpdatedAt) : Number.NaN;
    const serverNowMs = Date.now();
    const elapsedDays = Number.isFinite(moodUpdatedMs) ? Math.max(0, (serverNowMs - moodUpdatedMs) / 86_400_000) : null;
    const currentMoodScore = typeof pet.moodScore === "number" ? pet.moodScore : null;

    res.json({
      serverNow: new Date(serverNowMs).toISOString(),
      profile: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        accountMode: profile.account_mode,
        subscriptionTier: profile.subscription_tier,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        pet,
        gamesPlayed: typeof profile.stats?.gamesPlayed === "number" ? profile.stats.gamesPlayed : null,
        gamesWon: typeof profile.stats?.gamesWon === "number" ? profile.stats.gamesWon : null,
      },
      account,
      activity: { gameEvents, analyticsEvents, dailyQuest },
      decayDiagnostic: {
        lastDailyActivityDate,
        moodUpdatedAt,
        elapsedDays,
        configuredLossPerDay: 8,
        storedMoodScore: currentMoodScore,
      },
    });
  } catch (error) {
    console.error("Pet mood diagnostic failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Diagnostic failed" });
  }
});

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
