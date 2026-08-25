import { Router } from "express";
import type { AuthenticatedRequest } from "../auth";
import { requireAuth } from "../auth";
import { query } from "../db";
import { applyHintCoinOperation } from "../hintCoinRepository";

export const assignedWordsRouter = Router();

const normalizeWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === "string").map((word) => word.trim().toUpperCase()).filter(Boolean)))
  : [];

assignedWordsRouter.use(requireAuth);

assignedWordsRouter.post("/hint-coins", async (req: AuthenticatedRequest, res) => {
  try {
    const action = req.body?.action === "refund" ? "refund" : "charge";
    const result = await applyHintCoinOperation(req.user!.id, req.body?.operationId, action, req.body?.cost);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(result);
  } catch (error) {
    res.status(400).json({ code: "hint_coin_operation_failed", error: error instanceof Error ? error.message : "Не удалось обработать стоимость подсказки." });
  }
});

assignedWordsRouter.get("/assigned-words", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query<{
      id: string;
      title: string;
      classLabel: string | null;
      theme: string | null;
      source: string;
      words: string[];
      createdAt: string;
    }>(
      `select id,
              title,
              class_label as "classLabel",
              theme,
              source,
              words,
              created_at as "createdAt"
         from assigned_word_sets
        where learner_user_id = $1
          and archived_at is null
        order by created_at desc`,
      [req.user!.id],
    );

    const sets = result.rows.map((set) => ({ ...set, words: normalizeWords(set.words) }));
    const words = Array.from(new Set(sets.flatMap((set) => set.words))).sort();
    res.json({ sets, words });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Assigned words load failed" });
  }
});
