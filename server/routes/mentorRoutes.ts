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
      `select p.id,
              coalesce(p.child_display_name, p.username, 'Ученик') as name,
              l.class_label,
              p.child_share_code,
              p.stats,
              max(s.created_at) as last_assigned_at,
              coalesce(array_agg(distinct word) filter (where word is not null), '{}') as assigned_words
         from adult_learner_links l
         join profiles p on p.id = l.learner_user_id
         left join assigned_word_sets s on s.adult_user_id = l.adult_user_id and s.learner_user_id = l.learner_user_id and s.archived_at is null
         left join lateral unnest(s.words) word on true
        where l.adult_user_id = $1
        group by p.id, p.username, p.child_display_name, p.child_share_code, p.stats, l.class_label
        order by name`,
      [req.user!.id],
    );
    res.json({ learners: result.rows, backendReady: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Learners load failed" });
  }
});

mentorRouter.post("/connect", async (req: AuthenticatedRequest, res) => {
  try {
    const code = text(req.body?.code).toUpperCase();
    if (!code) { res.status(400).json({ error: "Code is required" }); return; }
    const found = await query<{ id: string }>("select id from profiles where upper(child_share_code) = $1 limit 1", [code]);
    const learnerId = found.rows[0]?.id;
    if (!learnerId) { res.status(404).json({ error: "Learner not found" }); return; }
    await query("insert into adult_learner_links (adult_user_id, learner_user_id, relation_role) values ($1, $2, 'teacher') on conflict (adult_user_id, learner_user_id) do update set relation_role = 'teacher'", [req.user!.id, learnerId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Learner connect failed" });
  }
});

mentorRouter.post("/assign", async (req: AuthenticatedRequest, res) => {
  try {
    const learnerId = text(req.body?.learnerId);
    const collectionId = text(req.body?.collectionId);
    if (!learnerId || !collectionId) { res.status(400).json({ error: "Learner and collection are required" }); return; }
    const link = await query("select 1 from adult_learner_links where adult_user_id = $1 and learner_user_id = $2 limit 1", [req.user!.id, learnerId]);
    if (!link.rows.length) { res.status(403).json({ error: "Learner is not connected" }); return; }
    const profile = await query<{ dictionary_collections: unknown }>("select dictionary_collections from profiles where id = $1", [req.user!.id]);
    const collections = Array.isArray(profile.rows[0]?.dictionary_collections) ? profile.rows[0].dictionary_collections as any[] : [];
    const collection = collections.find(item => String(item?.id || "") === collectionId);
    if (!collection) { res.status(404).json({ error: "Collection not found" }); return; }
    const words = wordsOf(collection.words);
    if (!words.length) { res.status(400).json({ error: "Collection is empty" }); return; }
    await query(
      `insert into assigned_word_sets (adult_user_id, learner_user_id, title, class_label, theme, source, words)
       values ($1, $2, $3, $4, $5, $6, $7::text[])`,
      [req.user!.id, learnerId, String(collection.title || "Словарь"), collection.classLabel || collection.class_label || null, collection.theme || null, collection.source || "manual", words],
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Dictionary assign failed" });
  }
});
