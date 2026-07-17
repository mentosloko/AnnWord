import type { NextFunction, Response } from "express";
import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";
import { optionalAuth } from "../optionalAuth";
import { getCustomWordsMissingTranslation, normalizeCustomDictionary } from "../../services/dictionaryEngine";

export const analyticsRouter = Router();

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value.slice(0, 500) : fallback;
const nullableText = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
const dateValue = (value: unknown): string => {
  const raw = typeof value === "string" ? value : "";
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    try {
      const result = await query<{ role: string | null }>("select role from profiles where id = $1", [req.user!.id]);
      if (result.rows[0]?.role !== "admin") {
        res.status(403).json({ code: "admin_required", error: "Forbidden" });
        return;
      }
      next();
    } catch (error) {
      console.error("Admin authorization failed", error);
      res.status(500).json({ code: "admin_check_failed", error: "Admin authorization failed" });
    }
  });
}

/**
 * Guest analytics remain accepted, but a user id is attached only after the
 * Yandex session has been verified. A browser can no longer attribute events
 * to an arbitrary profile by supplying user_id in JSON.
 */
analyticsRouter.post("/events", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rawEvents = Array.isArray(req.body?.events) ? req.body.events : Array.isArray(req.body) ? req.body : [];
    const events = rawEvents.filter(isObject).slice(0, 50);
    if (!events.length) {
      res.json({ ok: true, inserted: 0 });
      return;
    }

    const authenticatedUserId = req.user?.id || null;
    const values: unknown[] = [];
    const placeholders = events.map((event, index) => {
      const offset = index * 10;
      values.push(
        authenticatedUserId,
        nullableText(event.session_id),
        text(event.event_type, "unknown"),
        text(event.event_name, "unknown"),
        nullableText(event.game_type),
        nullableText(event.route),
        dateValue(event.occurred_at),
        JSON.stringify(isObject(event.payload) ? event.payload : {}),
        nullableText(event.app_version),
        nullableText(event.device_type),
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}::jsonb, $${offset + 9}, $${offset + 10})`;
    });

    await query(
      `insert into analytics_events (user_id, session_id, event_type, event_name, game_type, route, occurred_at, payload, app_version, device_type)
       values ${placeholders.join(", ")}`,
      values,
    );
    res.json({ ok: true, inserted: events.length });
  } catch (error) {
    console.error("Analytics events write failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Analytics events write failed" });
  }
});

analyticsRouter.get("/admin", requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const [gameStats, economyStats, eventSummary, dictionaries] = await Promise.all([
      query<{
        day: string;
        game_type: string | null;
        games_started: number;
        games_finished: number;
        games_won: number;
        unique_users: number;
      }>(
        `select occurred_at::date::text as day,
                game_type,
                count(*) filter (where event_name = 'game_started')::int as games_started,
                count(*) filter (where event_name = 'game_finished')::int as games_finished,
                count(*) filter (
                  where event_name = 'game_finished'
                    and (payload->>'won' = 'true' or payload->'input'->>'won' = 'true')
                )::int as games_won,
                count(distinct user_id) filter (where user_id is not null)::int as unique_users
           from analytics_events
          where occurred_at >= current_date - interval '30 days'
            and event_name in ('game_started', 'game_finished')
          group by occurred_at::date, game_type
          order by occurred_at::date desc, game_type nulls last
          limit 120`,
      ),
      query<{
        day: string;
        coins_earned: number;
        coins_spent: number;
        purchases: number;
        items_used: number;
      }>(
        `with days as (
           select occurred_at::date as day from game_events where occurred_at >= current_date - interval '30 days'
           union
           select occurred_at::date as day from analytics_events where occurred_at >= current_date - interval '30 days'
         ), rewards as (
           select occurred_at::date as day, coalesce(sum(greatest(coins_delta, 0)), 0)::int as coins_earned
             from game_events
            where occurred_at >= current_date - interval '30 days'
            group by occurred_at::date
         ), client_events as (
           select occurred_at::date as day,
                  coalesce(sum(case
                    when event_name = 'shop_item_bought'
                     and jsonb_typeof(payload->'coinsBefore') = 'number'
                     and jsonb_typeof(payload->'coinsAfter') = 'number'
                    then greatest((payload->>'coinsBefore')::numeric - (payload->>'coinsAfter')::numeric, 0)
                    else 0 end), 0)::int as coins_spent,
                  count(*) filter (where event_name = 'shop_item_bought')::int as purchases,
                  count(*) filter (where event_name = 'inventory_item_used')::int as items_used
             from analytics_events
            where occurred_at >= current_date - interval '30 days'
            group by occurred_at::date
         )
         select d.day::text as day,
                coalesce(r.coins_earned, 0)::int as coins_earned,
                coalesce(c.coins_spent, 0)::int as coins_spent,
                coalesce(c.purchases, 0)::int as purchases,
                coalesce(c.items_used, 0)::int as items_used
           from days d
           left join rewards r on r.day = d.day
           left join client_events c on c.day = d.day
          order by d.day desc
          limit 30`,
      ),
      query<{ event_type: string; event_name: string; count: number }>(
        `select event_type, event_name, count(*)::int as count
           from (
             select event_type, event_name
               from analytics_events
              order by occurred_at desc
              limit 1000
           ) recent
          group by event_type, event_name
          order by count(*) desc, event_type, event_name`,
      ),
      query<{ id: string; username: string | null; custom_dictionary_en: unknown }>(
        `select id, username, custom_dictionary_en
           from profiles
          where jsonb_typeof(custom_dictionary_en) = 'array'
            and jsonb_array_length(custom_dictionary_en) > 0
          order by username nulls last
          limit 2000`,
      ),
    ]);

    const unsupportedDictionaryWords = dictionaries.rows
      .map((row) => {
        const words = Array.isArray(row.custom_dictionary_en)
          ? normalizeCustomDictionary(row.custom_dictionary_en.filter((word): word is string => typeof word === "string"))
          : [];
        return {
          userId: row.id,
          username: row.username || "Без имени",
          words: getCustomWordsMissingTranslation(words).sort((first, second) => first.localeCompare(second)),
        };
      })
      .filter((row) => row.words.length > 0)
      .sort((first, second) => first.username.localeCompare(second.username));

    res.json({
      gameStats: gameStats.rows,
      economyStats: economyStats.rows,
      eventSummary: eventSummary.rows,
      unsupportedDictionaryWords,
    });
  } catch (error) {
    console.error("Admin analytics load failed", error);
    res.status(500).json({ code: "admin_analytics_failed", error: "Не удалось загрузить аналитику." });
  }
});
