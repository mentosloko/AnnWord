import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";

export const mentorRouter = Router();

const text = (value: unknown): string => String(value || "").trim();
const wordsOf = (value: unknown): string[] => Array.isArray(value) ? Array.from(new Set(value.filter((word): word is string => typeof word === "string").map(word => word.trim().toUpperCase()).filter(Boolean))) : [];

mentorRouter.use(requireAuth);

mentorRouter.get("/learners", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query(
      `with linked_learners as (
         select p.id,
                coalesce(p.child_display_name, p.username, 'Ученик') as name,
                l.class_label,
                p.child_share_code,
                p.stats,
                latest_set.created_at as last_assigned_at,
                coalesce(latest_set.words, '{}'::text[]) as assigned_words
           from adult_learner_links l
           join profiles p on p.id = l.learner_user_id
           left join lateral (
             select s.words, s.created_at
               from assigned_word_sets s
              where s.adult_user_id = l.adult_user_id
                and s.learner_user_id = l.learner_user_id
                and s.archived_at is null
              order by s.created_at desc
              limit 1
           ) latest_set on true
          where l.adult_user_id = $1
       ), self_child as (
         select p.id,
                coalesce(p.child_display_name, p.username, 'Ребёнок') as name,
                null::text as class_label,
                p.child_share_code,
                p.stats,
                latest_set.created_at as last_assigned_at,
                coalesce(latest_set.words, '{}'::text[]) as assigned_words
           from profiles p
           left join lateral (
             select s.words, s.created_at
               from assigned_word_sets s
              where s.learner_user_id = p.id
                and s.archived_at is null
              order by s.created_at desc
              limit 1
           ) latest_set on true
          where p.id = $1
            and p.account_mode = 'parent'
            and p.child_display_name is not null
       )
       select * from linked_learners
       union all
       select * from self_child
        where not exists (select 1 from linked_learners where linked_learners.id = self_child.id)
       order by name`,
      [req.user!.id],
    );
    res.json({ learners: result.rows, backendReady: true });
  } catch (error) {
    console.error("Learners load failed", error);
    res.status(500).json({ code: "learners_load_failed", error: "Не удалось загрузить данные учеников. Попробуйте ещё раз." });
  }
});

mentorRouter.post("/connect", async (req: AuthenticatedRequest, res) => {
  try {
    const code = text(req.body?.code).toUpperCase();
    if (!code) { res.status(400).json({ code: "child_code_required", error: "Введите код ребёнка." }); return; }
    const found = await query<{ id: string }>("select id from profiles where upper(child_share_code) = $1 limit 1", [code]);
    const learnerId = found.rows[0]?.id;
    if (!learnerId) { res.status(404).json({ code: "learner_not_found", error: "Ученик с таким кодом не найден." }); return; }
    await query("insert into adult_learner_links (adult_user_id, learner_user_id, relation_role) values ($1, $2, 'teacher') on conflict (adult_user_id, learner_user_id) do update set relation_role = 'teacher'", [req.user!.id, learnerId]);
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
    const link = await query("select 1 from adult_learner_links where adult_user_id = $1 and learner_user_id = $2 limit 1", [req.user!.id, learnerId]);
    if (!link.rows.length) { res.status(403).json({ code: "learner_unavailable", error: "Ученик не подключён к вашему кабинету." }); return; }
    const profile = await query<{ dictionary_collections: unknown }>("select dictionary_collections from profiles where id = $1", [req.user!.id]);
    const collections = Array.isArray(profile.rows[0]?.dictionary_collections) ? profile.rows[0].dictionary_collections as any[] : [];
    const collection = collections.find(item => String(item?.id || "") === collectionId);
    if (!collection) { res.status(404).json({ code: "dictionary_not_found", error: "Словарь не найден." }); return; }
    const words = wordsOf(collection.words);
    if (!words.length) { res.status(400).json({ code: "dictionary_empty", error: "В словаре нет слов для назначения." }); return; }
    await query("update assigned_word_sets set archived_at = now() where learner_user_id = $1 and archived_at is null", [learnerId]);
    await query(
      `insert into assigned_word_sets (adult_user_id, learner_user_id, title, class_label, theme, source, words)
       values ($1, $2, $3, $4, $5, $6, $7::text[])`,
      [req.user!.id, learnerId, String(collection.title || "Словарь"), collection.classLabel || collection.class_label || null, collection.theme || null, collection.source || "manual", words],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Dictionary assignment failed", error);
    res.status(400).json({ code: "dictionary_assignment_failed", error: error instanceof Error ? error.message : "Не удалось назначить словарь." });
  }
});