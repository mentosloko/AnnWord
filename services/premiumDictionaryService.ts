import { supabase } from '../supabase';
import { CustomDictionaryCollection } from '../types';

export interface PremiumDictionaryDraft {
  title: string;
  words: string[];
  source: CustomDictionaryCollection['source'];
  classLabel?: string;
  theme?: string;
}

const SCHEMA_NOT_READY_CODES = new Set(['PGRST202', '42P01', '42703', '42883']);
const schemaNotReady = (error: any): boolean => Boolean(error) && (
  SCHEMA_NOT_READY_CODES.has(String(error.code || ''))
  || /does not exist|could not find the function|schema cache|column .* does not exist/i.test(String(error.message || ''))
);

const normalizeWords = (words: string[]): string[] => Array.from(new Set(
  words.map(word => word.trim().toUpperCase()).filter(word => /^[A-Z][A-Z'-]{1,}$/.test(word)),
));

const normalizeCollection = (data: any, draft: PremiumDictionaryDraft, words: string[]): CustomDictionaryCollection => ({
  id: String(data?.id || crypto.randomUUID()),
  title: String(data?.title || draft.title || 'Новый словарь'),
  source: (data?.source || draft.source) as CustomDictionaryCollection['source'],
  words,
  classLabel: typeof data?.classLabel === 'string' ? data.classLabel : draft.classLabel,
  theme: typeof data?.theme === 'string' ? data.theme : draft.theme,
  createdAt: typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
});

export const premiumDictionaryService = {
  async saveCollection(draft: PremiumDictionaryDraft): Promise<CustomDictionaryCollection> {
    const words = normalizeWords(draft.words);
    if (!words.length) throw new Error('Добавьте хотя бы одно английское слово.');
    const { data, error } = await supabase.rpc('save_premium_dictionary_collection', {
      p_title: draft.title,
      p_words: words,
      p_source: draft.source,
      p_class_label: draft.classLabel || null,
      p_theme: draft.theme || null,
    });
    if (error) {
      if (schemaNotReady(error)) {
        throw new Error('Сохранение Premium-словарей включится после применения backend-схемы этой ветки. OCR и редактирование уже доступны для проверки.');
      }
      if (/premium required/i.test(String(error.message || ''))) {
        throw new Error('Создание собственных словарей доступно в Premium.');
      }
      throw error;
    }
    return normalizeCollection(data, draft, words);
  },
};