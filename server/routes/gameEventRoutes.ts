import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";

export const gameEventRouter = Router();

gameEventRouter.use(requireAuth);

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value.slice(0, 500) : fallback;
const nullableText = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
const numberValue = (value: unknown): number => Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
const dateValue = (value: unknown): string => {
  const raw = typeof value === "string" ? value : "";
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const questDate = (value: unknown): string | null => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

gameEventRouter.post("/events", async (req: AuthenticatedRequest, res) => {
  try {
    const rawEvents = Array.isArray(req.body?.events) ? req.body.events : Array.isArray(req.body) ? req.body : [];
    const events = rawEvents.filter(isObject).slice(0, 100);
    if (!events.length) {
      res.json({ ok: true, inserted: 0 });
      return;
    }

    const values: unknown[] = [];
    const placeholders = events.map((event, index) => {
      const offset = index * 11;
      values.push(
        req.user!.id,
        text(event.eventKey || event.event_key, `${req.user!.id}:${Date.now()}:${index}`),
        text(event.eventType || event.event_type, "unknown"),
        nullableText(event.gameMode || event.game_mode),
        nullableText(event.word),
        nullableText(event.result),
        questDate(event.questDate || event.quest_date),
        nullableText(event.questKind || event.quest_kind),
        numberValue(event.coinsDelta ?? event.coins_delta),
        numberValue(event.xpDelta ?? event.xp_delta),
        JSON.stringify(isObject(event.payload) ? event.payload : {}),
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}::jsonb, now())`;
    });

    await query(
      `insert into game_events (user_id, event_key, event_type, game_mode, word, result, quest_date, quest_kind, coins_delta, xp_delta, payload, occurred_at)
       values ${placeholders.join(", ")}
       on conflict (event_key) do nothing`,
      values,
    );
    res.json({ ok: true, inserted: events.length });
  } catch (error) {
    console.error("Game events write failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Game events write failed" });
  }
});
