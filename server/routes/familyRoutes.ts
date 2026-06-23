import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";
import { readRequiredEnv } from "../config";

export const familyRouter = Router();

const text = (value: unknown): string => String(value || "").trim();
const digest = (value: string): string => createHmac("sha256", readRequiredEnv("COOKIE_SECRET")).update(value).digest("hex");
const same = (left: string, right: string): boolean => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const randomCode = (): string => Math.random().toString(36).slice(2, 8).toUpperCase();

familyRouter.use(requireAuth);

familyRouter.post("/account-mode", async (req: AuthenticatedRequest, res) => {
  try {
    const mode = text(req.body?.mode);
    if (!['player', 'parent', 'teacher'].includes(mode)) { res.status(400).json({ error: 'Invalid account mode' }); return; }
    const role = mode === 'parent' ? 'parent' : mode === 'teacher' ? 'teacher' : 'user';
    const featureFlags = mode === 'player' ? {} : { adultRoom: true };
    await query("update profiles set role = $2, account_mode = $3, feature_flags = $4::jsonb, updated_at = now() where id = $1", [req.user!.id, role, mode, JSON.stringify(featureFlags)]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Account mode update failed' });
  }
});

familyRouter.post("/child", async (req: AuthenticatedRequest, res) => {
  try {
    const childName = text(req.body?.childName);
    const accessCode = text(req.body?.accessCode);
    if (!childName || childName.length > 40) { res.status(400).json({ error: 'Invalid child name' }); return; }
    if (!/^\d{4}$/.test(accessCode)) { res.status(400).json({ error: 'Invalid access code' }); return; }
    let shareCode = randomCode();
    for (let i = 0; i < 5; i += 1) {
      const exists = await query("select 1 from profiles where child_share_code = $1 limit 1", [shareCode]);
      if (!exists.rows.length) break;
      shareCode = randomCode();
    }
    await query(
      "update profiles set child_display_name = $2, child_share_code = $3, child_slots_limit = 1, access_digest = $4, role = 'parent', account_mode = 'parent', feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{adultRoom}', 'true'::jsonb, true), updated_at = now() where id = $1",
      [req.user!.id, childName, shareCode, digest(accessCode)],
    );
    res.json({ childName, childShareCode: shareCode, childSlotsLimit: 1 });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Child setup failed' });
  }
});

familyRouter.post("/access-check", async (req: AuthenticatedRequest, res) => {
  try {
    const accessCode = text(req.body?.accessCode);
    const result = await query<{ access_digest: string | null }>("select access_digest from profiles where id = $1", [req.user!.id]);
    const stored = result.rows[0]?.access_digest || '';
    res.json({ ok: Boolean(stored && same(stored, digest(accessCode))) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Access check failed' });
  }
});
