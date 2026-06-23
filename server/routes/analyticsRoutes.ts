import { Router } from "express";
import { query } from "../db";

export const analyticsRouter = Router();

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value.slice(0, 500) : fallback;
const nullableText = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
const nullableUuid = (value: unknown): string | null => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
const dateValue = (value: unknown): string => {
  const raw = typeof value === "string" ? value : "";
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

analyticsRouter.post("/events", async (req, res) => {
  try {
    const rawEvents = Array.isArray(req.body?.events) ? req.body.events : Array.isArray(req.body) ? req.body : [];
    const events = rawEvents.filter(isObject).slice(0, 50);
    if (!events.length) {
      res.json({ ok: true, inserted: 0 });
      return;
    }

    const values: unknown[] = [];
    const placeholders = events.map((event, index) => {
      const offset = index * 10;
      values.push(
        nullableUuid(event.user_id),
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
