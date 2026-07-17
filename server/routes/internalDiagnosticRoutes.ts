import { timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { query } from "../db";

export const internalDiagnosticRouter = Router();

const readHeader = (req: Request): string => {
  const value = req.headers["x-annword-diagnostic-secret"];
  return typeof value === "string" ? value : "";
};

const isAuthorized = (req: Request): boolean => {
  const expected = process.env.ANNWORD_MIGRATION_SECRET || "";
  const actual = readHeader(req);
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
};

const safeAggregate = async <T>(sql: string, userId: string): Promise<T | null> => {
  try {
    const result = await query<T & Record<string, unknown>>(sql, [userId]);
    return (result.rows[0] as T | undefined) || null;
  } catch (error) {
    console.warn("Optional diagnostic query failed", error);
    return null;
  }
};

internalDiagnosticRouter.get("/pet-mood/:userId", async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const userId = String(req.params.userId || "").trim();
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
    }>(
      `select id, email, created_at, updated_at from app_users where id = $1`,
      userId,
    );
    const gameEvents = await safeAggregate<{ count: number; last_occurred_at: string | Date | null }>(
      `select count(*)::int as count, max(occurred_at) as last_occurred_at from game_events where user_id = $1`,
      userId,
    );
    const analyticsEvents = await safeAggregate<{ count: number; last_occurred_at: string | Date | null }>(
      `select count(*)::int as count, max(occurred_at) as last_occurred_at from analytics_events where user_id = $1`,
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
    const lastDailyActivityMs = lastDailyActivityDate ? Date.parse(`${lastDailyActivityDate}T00:00:00+03:00`) : Number.NaN;
    const serverNowMs = Date.now();
    const elapsedDays = Number.isFinite(lastDailyActivityMs) ? Math.max(0, (serverNowMs - lastDailyActivityMs) / 86_400_000) : null;
    const currentMoodScore = typeof pet.moodScore === "number" ? pet.moodScore : null;
    const theoreticalMoodScore = currentMoodScore !== null && elapsedDays !== null
      ? Math.max(0, Math.round(currentMoodScore - elapsedDays * 8))
      : null;

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
      activity: {
        gameEvents,
        analyticsEvents,
        dailyQuest,
      },
      decayDiagnostic: {
        lastDailyActivityDate,
        elapsedDays,
        configuredLossPerDay: 8,
        storedMoodScore: currentMoodScore,
        theoreticalMoodScoreWithoutInterveningActivity: theoreticalMoodScore,
      },
    });
  } catch (error) {
    console.error("Pet mood diagnostic failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Diagnostic failed" });
  }
});
