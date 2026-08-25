import { createHash } from "node:crypto";
import { Router, type NextFunction, type Response } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { resolveDictionaryWordTranslations } from "../../services/masterDictionaryLookup";
import { query, transaction } from "../db";
import { loadManagedLearners } from "../mentorRepository";
import { sendPostboxEmail } from "../postboxEmailService";

export const mentorRouter = Router();

const text = (value: unknown): string => String(value || "").trim();
const wordsOf = (value: unknown): string[] => Array.isArray(value) ? Array.from(new Set(value.filter((word): word is string => typeof word === "string").map(word => word.trim().toUpperCase()).filter(Boolean))) : [];
const inviteHash = (code: string): string => createHash("sha256").update(code).digest("hex");
const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MIN_ASSIGNABLE_WORDS = 3;

const requireTeacherAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const result = await query<{ role: string | null; account_mode: string | null }>(
    "select role, account_mode from profiles where id = $1",
    [req.user!.id],
  );
  const profile = result.rows[0];
  if (profile?.role !== "teacher" && profile?.account_mode !== "teacher") {
    res.status(403).json({ code: "teacher_account_required", error: "Доступно только в кабинете преподавателя." });
    return;
  }
  next();
};

mentorRouter.use(requireAuth);
mentorRouter.use(requireTeacherAccount);

mentorRouter.get("/learners", async (req: AuthenticatedRequest, res) => {
  const startedAt = Date.now();
  try {
    const learners = await loadManagedLearners(req.user!.id);
    res.setHeader("Server-Timing", `learners_total;dur=${Date.now() - startedAt}`);
    res.setHeader("Access-Control-Expose-Headers", "Server-Timing");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ learners, backendReady: true });
  } catch (error) {
    console.error("Learners load failed", error);
    res.status(500).json({ code: "learners_load_failed", error: "Не удалось загрузить данные учеников. Попробуйте ещё раз." });
  }
});

mentorRouter.post("/connect", async (req: AuthenticatedRequest, res) => {
  try {
    const code = text(req.body?.code).toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      res.status(400).json({ code: "child_code_invalid", error: "Введите код ребёнка из 6 символов." });
      return;
    }

    const connected = await transaction(async (client) => {
      const invite = await client.query<{ id: string; learner_user_id: string }>(
        `select id, learner_user_id
           from teacher_connection_invites
          where code_hash = $1
            and used_at is null
            and expires_at > now()
          for update`,
        [inviteHash(code)],
      );
      const row = invite.rows[0];
      if (!row) return null;
      if (row.learner_user_id === req.user!.id) return null;

      await client.query(
        `insert into adult_learner_links (adult_user_id, learner_user_id, relation_role, revoked_at, created_at)
         values ($1, $2, 'teacher', null, now())
         on conflict (adult_user_id, learner_user_id)
         do update set relation_role = 'teacher', revoked_at = null, created_at = now()`,
        [req.user!.id, row.learner_user_id],
      );
      await client.query(
        `update teacher_connection_invites
            set used_at = now(), used_by_teacher_id = $2
          where id = $1`,
        [row.id, req.user!.id],
      );
      await client.query("update profiles set child_share_code = null, updated_at = now() where id = $1", [row.learner_user_id]);
      const parent = await client.query<{ email: string }>("select email from app_users where id = $1", [row.learner_user_id]);
      return { learnerId: row.learner_user_id, parentEmail: parent.rows[0]?.email || "" };
    });

    if (!connected) {
      res.status(404).json({ code: "learner_invite_unavailable", error: "Код недействителен, уже использован или истёк. Попросите родителя создать новый код." });
      return;
    }

    if (connected.parentEmail) {
      const teacherLabel = req.user!.name || req.user!.email;
      await sendPostboxEmail(connected.parentEmail, {
        subject: "Преподаватель подключён к AnnWord Kids",
        text: `К профилю ребёнка в AnnWord подключён преподаватель: ${teacherLabel}. Если вы не ожидали это подключение, откройте кабинет родителя и нажмите «Отозвать доступ».`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172554;line-height:1.5"><h1 style="font-size:24px">Преподаватель подключён</h1><p>К профилю ребёнка подключён преподаватель: <strong>${escapeHtml(teacherLabel)}</strong>.</p><p>Если вы не ожидали это подключение, откройте кабинет родителя AnnWord и нажмите «Отозвать доступ».</p></div>`,
      }).catch(error => console.error("Teacher connection parent notification failed", { learnerId: connected.learnerId, error }));
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Learner connect failed", error);
    res.status(400).json({ code: "learner_connect_failed", error: error instanceof Error ? error.message : "Не удалось подключить ученика." });
  }
});

mentorRouter.post("/assign", async (req: AuthenticatedRequest, res) => {
  try {
    const learnerId = text(req.body?.learnerId);
    const collectionId = text(req.body?.collectionId);
    if (!learnerId || !collectionId) { res.status(400).json({ code: "assignment_input_required", error: "Выберите ученика и словарь." }); return; }
    const link = await query("select 1 from adult_learner_links where adult_user_id = $1 and learner_user_id = $2 and relation_role = 'teacher' and revoked_at is null limit 1", [req.user!.id, learnerId]);
    if (!link.rows.length) { res.status(403).json({ code: "learner_unavailable", error: "Ученик не подключён к вашему кабинету." }); return; }
    const profile = await query<{ dictionary_collections: unknown }>("select dictionary_collections from profiles where id = $1", [req.user!.id]);
    const collections = Array.isArray(profile.rows[0]?.dictionary_collections) ? profile.rows[0].dictionary_collections as any[] : [];
    const collection = collections.find(item => String(item?.id || "") === collectionId);
    if (!collection) { res.status(404).json({ code: "dictionary_not_found", error: "Словарь не найден." }); return; }
    const words = wordsOf(collection.words);
    if (!words.length) { res.status(400).json({ code: "dictionary_empty", error: "В словаре нет слов для назначения." }); return; }

    const resolution = await resolveDictionaryWordTranslations(words, collection.wordTranslations || collection.word_translations);
    if (resolution.missingWords.length) {
      res.status(400).json({
        code: "dictionary_translation_required",
        error: `Сначала добавьте русский перевод для: ${resolution.missingWords.join(", ")}.`,
      });
      return;
    }
    if (resolution.readyWords.length < MIN_ASSIGNABLE_WORDS) {
      res.status(400).json({
        code: "dictionary_too_small_for_games",
        error: `Для назначения нужно минимум ${MIN_ASSIGNABLE_WORDS} слова с переводом. Сейчас готово: ${resolution.readyWords.length}.`,
      });
      return;
    }

    await transaction(async client => {
      await client.query("update assigned_word_sets set archived_at = now() where learner_user_id = $1 and archived_at is null", [learnerId]);
      await client.query(
        `insert into assigned_word_sets (adult_user_id, learner_user_id, title, class_label, theme, source, words, word_translations)
         values ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb)`,
        [
          req.user!.id,
          learnerId,
          String(collection.title || "Словарь"),
          collection.classLabel || collection.class_label || null,
          collection.theme || null,
          collection.source || "manual",
          resolution.readyWords,
          JSON.stringify(resolution.translations),
        ],
      );
    });
    res.json({ ok: true, readyWords: resolution.readyWords.length });
  } catch (error) {
    console.error("Dictionary assignment failed", error);
    res.status(400).json({ code: "dictionary_assignment_failed", error: error instanceof Error ? error.message : "Не удалось назначить словарь." });
  }
});
