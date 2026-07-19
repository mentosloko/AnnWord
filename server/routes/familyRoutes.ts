import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query, transaction } from "../db";
import { readRequiredEnv } from "../config";
import { loadManagedLearners } from "../mentorRepository";

export const familyRouter = Router();

const text = (value: unknown): string => String(value || "").trim();
const digest = (value: string): string => createHmac("sha256", readRequiredEnv("COOKIE_SECRET")).update(value).digest("hex");
const same = (left: string, right: string): boolean => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const randomCode = (): string => Math.random().toString(36).slice(2, 8).toUpperCase();
const childConsentVersion = "2026-07-15";

const hasValidChildConsent = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const consent = value as Record<string, unknown>;
  return consent.legalRepresentativeConfirmed === true && consent.childPersonalDataAccepted === true;
};

const verifyAccessCode = async (userId: string, accessCode: string): Promise<boolean> => {
  const result = await query<{ access_digest: string | null }>("select access_digest from profiles where id = $1", [userId]);
  const stored = result.rows[0]?.access_digest || "";
  return Boolean(stored && same(stored, digest(accessCode)));
};

familyRouter.use(requireAuth);

familyRouter.post("/account-mode", async (req: AuthenticatedRequest, res) => {
  try {
    const mode = text(req.body?.mode);
    if (!["player", "parent", "teacher"].includes(mode)) { res.status(400).json({ error: "Invalid account mode" }); return; }
    const role = mode === "parent" ? "parent" : mode === "teacher" ? "teacher" : "user";
    const featureFlags = mode === "player" ? {} : { adultRoom: true };
    await query("update profiles set role = $2, account_mode = $3, feature_flags = $4::jsonb, updated_at = now() where id = $1", [req.user!.id, role, mode, JSON.stringify(featureFlags)]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Account mode update failed" });
  }
});

familyRouter.post("/child", async (req: AuthenticatedRequest, res) => {
  try {
    const childName = text(req.body?.childName);
    const accessCode = text(req.body?.accessCode);
    if (!childName || childName.length > 40) { res.status(400).json({ error: "Invalid child name" }); return; }
    if (!/^\d{4}$/.test(accessCode)) { res.status(400).json({ error: "Invalid access code" }); return; }
    if (!hasValidChildConsent(req.body?.consent)) {
      res.status(400).json({ code: "child_personal_data_consent_required", error: "Необходимо подтвердить полномочия законного представителя и согласие на обработку данных ребёнка." });
      return;
    }

    const shareCode = await transaction(async (client) => {
      let nextShareCode = randomCode();
      for (let i = 0; i < 5; i += 1) {
        const exists = await client.query("select 1 from profiles where child_share_code = $1 limit 1", [nextShareCode]);
        if (!exists.rows.length) break;
        nextShareCode = randomCode();
      }
      await client.query(
        "update profiles set child_display_name = $2, child_share_code = $3, child_slots_limit = 1, access_digest = $4, role = 'parent', account_mode = 'parent', feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{adultRoom}', 'true'::jsonb, true), updated_at = now() where id = $1",
        [req.user!.id, childName, nextShareCode, digest(accessCode)],
      );
      await client.query(
        `insert into user_consents (user_id, consent_type, granted, document_version, source, context)
         values ($1, 'child_personal_data', true, $2, 'web', $3::jsonb)`,
        [req.user!.id, childConsentVersion, JSON.stringify({ childProfile: "primary", legalRepresentativeConfirmed: true })],
      );
      return nextShareCode;
    });

    res.json({ childName, childShareCode: shareCode, childSlotsLimit: 1 });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Child setup failed" });
  }
});

familyRouter.post("/adult-room", async (req: AuthenticatedRequest, res) => {
  const startedAt = Date.now();
  try {
    const accessCode = text(req.body?.accessCode);
    if (!/^\d{4}$/.test(accessCode)) {
      res.status(400).json({ code: "invalid_access_code", error: "Введите PIN из 4 цифр." });
      return;
    }
    const verifiedAt = Date.now();
    const ok = await verifyAccessCode(req.user!.id, accessCode);
    if (!ok) {
      res.status(403).json({ code: "invalid_parent_pin", error: "Неверный PIN. Проверьте 4 цифры и попробуйте ещё раз." });
      return;
    }
    const learnersStartedAt = Date.now();
    const learners = await loadManagedLearners(req.user!.id);
    const completedAt = Date.now();
    res.setHeader("Server-Timing", `pin_verify;dur=${learnersStartedAt - verifiedAt}, learners;dur=${completedAt - learnersStartedAt}, adult_room_total;dur=${completedAt - startedAt}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, learners, backendReady: true });
  } catch (error) {
    res.status(400).json({ code: "adult_room_load_failed", error: error instanceof Error ? error.message : "Не удалось открыть кабинет родителя." });
  }
});

familyRouter.post("/access-check", async (req: AuthenticatedRequest, res) => {
  try {
    const accessCode = text(req.body?.accessCode);
    res.json({ ok: await verifyAccessCode(req.user!.id, accessCode) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Access check failed" });
  }
});
