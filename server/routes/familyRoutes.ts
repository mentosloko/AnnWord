import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query, transaction } from "../db";
import { readRequiredEnv } from "../config";
import { loadManagedLearners } from "../mentorRepository";
import { updateProfileAccountMode } from "../profileRepository";
import { requireParentAccess, writeParentAccessCookie } from "../parentAccess";

export const familyRouter = Router();

const text = (value: unknown): string => String(value || "").trim();
const digest = (value: string): string => createHmac("sha256", readRequiredEnv("COOKIE_SECRET")).update(value).digest("hex");
const same = (left: string, right: string): boolean => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const inviteHash = (code: string): string => createHash("sha256").update(code).digest("hex");
const childConsentVersion = "2026-07-15";
const TEACHER_INVITE_TTL_HOURS = 24;
const TEACHER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomCode = (): string => {
  const bytes = randomBytes(6);
  return Array.from(bytes, byte => TEACHER_CODE_ALPHABET[byte % TEACHER_CODE_ALPHABET.length]).join("");
};

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

const createTeacherInvite = async (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, learnerUserId: string): Promise<string> => {
  await client.query(
    "update teacher_connection_invites set expires_at = now() where learner_user_id = $1 and used_at is null and expires_at > now()",
    [learnerUserId],
  );

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    try {
      await client.query(
        `insert into teacher_connection_invites (learner_user_id, code_hash, expires_at)
         values ($1, $2, now() + interval '${TEACHER_INVITE_TTL_HOURS} hours')`,
        [learnerUserId, inviteHash(code)],
      );
      await client.query("update profiles set child_share_code = $2, updated_at = now() where id = $1", [learnerUserId, code]);
      return code;
    } catch (error) {
      const codeValue = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
      if (codeValue !== "23505") throw error;
    }
  }
  throw new Error("Не удалось создать уникальный код преподавателя. Попробуйте ещё раз.");
};

familyRouter.use(requireAuth);

familyRouter.post("/account-mode", async (req: AuthenticatedRequest, res) => {
  try {
    const mode = text(req.body?.mode);
    if (!["player", "parent", "teacher"].includes(mode)) { res.status(400).json({ error: "Invalid account mode" }); return; }
    const profile = await updateProfileAccountMode(req.user!.id, mode as "player" | "parent" | "teacher");
    res.json({ ok: true, profile });
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
      const existing = await client.query<{ child_display_name: string | null; child_share_code: string | null }>(
        "select child_display_name, child_share_code from profiles where id = $1 for update",
        [req.user!.id],
      );
      const current = existing.rows[0];
      if (current?.child_display_name || current?.child_share_code) {
        const error = new Error("Детский профиль уже создан. Изменяйте его только из кабинета родителя.") as Error & { code?: string };
        error.code = "child_profile_already_configured";
        throw error;
      }

      await client.query(
        "update profiles set child_display_name = $2, child_share_code = null, child_slots_limit = 1, access_digest = $3, role = 'parent', account_mode = 'parent', feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{adultRoom}', 'true'::jsonb, true), updated_at = now() where id = $1",
        [req.user!.id, childName, digest(accessCode)],
      );
      await client.query(
        `insert into user_consents (user_id, consent_type, granted, document_version, source, context)
         values ($1, 'child_personal_data', true, $2, 'web', $3::jsonb)`,
        [req.user!.id, childConsentVersion, JSON.stringify({ childProfile: "primary", legalRepresentativeConfirmed: true })],
      );
      return createTeacherInvite(client, req.user!.id);
    });

    res.json({ childName, childShareCode: shareCode, childSlotsLimit: 1 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    if (code === "child_profile_already_configured") {
      res.status(409).json({ code, error: error instanceof Error ? error.message : "Детский профиль уже создан." });
      return;
    }
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
    writeParentAccessCookie(res, req.user!.id);
    const learnersStartedAt = Date.now();
    const learners = await loadManagedLearners(req.user!.id);
    const completedAt = Date.now();
    res.setHeader("Server-Timing", `pin_verify;dur=${learnersStartedAt - verifiedAt}, learners;dur=${completedAt - learnersStartedAt}, adult_room_total;dur=${completedAt - startedAt}`);
    res.setHeader("Access-Control-Expose-Headers", "Server-Timing");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, learners, backendReady: true, parentAccessExpiresIn: 15 * 60 });
  } catch (error) {
    res.status(400).json({ code: "adult_room_load_failed", error: error instanceof Error ? error.message : "Не удалось открыть кабинет родителя." });
  }
});

familyRouter.post("/access-check", async (req: AuthenticatedRequest, res) => {
  try {
    const accessCode = text(req.body?.accessCode);
    const ok = await verifyAccessCode(req.user!.id, accessCode);
    if (ok) writeParentAccessCookie(res, req.user!.id);
    res.json({ ok, parentAccessExpiresIn: ok ? 15 * 60 : 0 });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Access check failed" });
  }
});

familyRouter.post("/teacher-invite", requireParentAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const code = await transaction(client => createTeacherInvite(client, req.user!.id));
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, code, expiresIn: TEACHER_INVITE_TTL_HOURS * 60 * 60 });
  } catch (error) {
    console.error("Teacher invite create failed", error);
    res.status(400).json({ code: "teacher_invite_create_failed", error: error instanceof Error ? error.message : "Не удалось создать код преподавателя." });
  }
});

familyRouter.get("/teacher-connections", requireParentAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query<{
      teacher_id: string;
      teacher_name: string | null;
      teacher_email: string;
      connected_at: Date | string;
    }>(
      `select l.adult_user_id as teacher_id,
              coalesce(u.full_name, p.username) as teacher_name,
              u.email as teacher_email,
              l.created_at as connected_at
         from adult_learner_links l
         join app_users u on u.id = l.adult_user_id
         join profiles p on p.id = l.adult_user_id
        where l.learner_user_id = $1
          and l.relation_role = 'teacher'
          and l.revoked_at is null
        order by l.created_at desc`,
      [req.user!.id],
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      connections: result.rows.map(row => ({
        teacherId: row.teacher_id,
        name: row.teacher_name || row.teacher_email,
        email: row.teacher_email,
        connectedAt: row.connected_at,
      })),
    });
  } catch (error) {
    console.error("Teacher connections load failed", error);
    res.status(500).json({ code: "teacher_connections_load_failed", error: "Не удалось загрузить подключённых преподавателей." });
  }
});

familyRouter.post("/teacher-connections/:teacherId/revoke", requireParentAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const teacherId = text(req.params.teacherId);
    if (!teacherId) { res.status(400).json({ code: "teacher_id_required", error: "Не выбран преподаватель." }); return; }
    const revoked = await transaction(async (client) => {
      const link = await client.query(
        `update adult_learner_links
            set revoked_at = now()
          where learner_user_id = $1
            and adult_user_id = $2
            and relation_role = 'teacher'
            and revoked_at is null
        returning adult_user_id`,
        [req.user!.id, teacherId],
      );
      if (!link.rows.length) return false;
      await client.query(
        "update assigned_word_sets set archived_at = now() where learner_user_id = $1 and adult_user_id = $2 and archived_at is null",
        [req.user!.id, teacherId],
      );
      return true;
    });
    if (!revoked) { res.status(404).json({ code: "teacher_connection_not_found", error: "Подключение преподавателя уже отозвано или не найдено." }); return; }
    res.json({ ok: true });
  } catch (error) {
    console.error("Teacher connection revoke failed", error);
    res.status(400).json({ code: "teacher_connection_revoke_failed", error: error instanceof Error ? error.message : "Не удалось отозвать доступ преподавателя." });
  }
});
