import { query } from "./db";
import type { CustomDictionaryCollection } from "../types";

const SOURCES = new Set(["manual", "ocr", "class", "topic"]);

const wordsOf = (input: unknown): string[] => Array.from(new Set(
  (Array.isArray(input) ? input : [])
    .filter((item): item is string => typeof item === "string")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => /^[A-Z][A-Z'-]{1,}$/.test(word)),
));

const readText = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeCollection = (value: any): CustomDictionaryCollection | null => {
  const words = wordsOf(value?.words);
  if (!words.length) return null;
  return {
    id: String(value?.id || crypto.randomUUID()),
    title: readText(value?.title) || "Словарь",
    source: SOURCES.has(value?.source) ? value.source : "manual",
    words,
    classLabel: readText(value?.classLabel) || readText(value?.class_label),
    theme: readText(value?.theme),
    createdAt: readText(value?.createdAt) || readText(value?.created_at) || new Date().toISOString(),
  };
};

export async function listDictionaryCollections(userId: string): Promise<CustomDictionaryCollection[]> {
  const result = await query<{ dictionary_collections: unknown }>("select dictionary_collections from profiles where id = $1", [userId]);
  const raw = result.rows[0]?.dictionary_collections;
  return (Array.isArray(raw) ? raw : []).map(normalizeCollection).filter((item): item is CustomDictionaryCollection => Boolean(item));
}

export async function saveDictionaryCollection(userId: string, draft: Pick<CustomDictionaryCollection, "title" | "source" | "words" | "classLabel" | "theme">): Promise<CustomDictionaryCollection> {
  const words = wordsOf(draft.words);
  if (!words.length) throw new Error("Добавьте хотя бы одно английское слово.");
  const collection: CustomDictionaryCollection = {
    id: crypto.randomUUID(),
    title: readText(draft.title) || "Новый словарь",
    source: SOURCES.has(draft.source) ? draft.source : "manual",
    words,
    classLabel: readText(draft.classLabel),
    theme: readText(draft.theme),
    createdAt: new Date().toISOString(),
  };
  const current = await listDictionaryCollections(userId);
  await query("update profiles set dictionary_collections = $2::jsonb, updated_at = now() where id = $1", [userId, JSON.stringify([collection, ...current])]);
  return collection;
}
