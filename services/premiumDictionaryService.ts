import { supabase } from '../supabase';
import { CustomDictionaryCollection, UserProfile } from '../types';
import { normalizeEnglishWordArray } from '../utils/wordListParser';
import { backendApiRequest, isBackendApiConfigured } from './backendApiClient';

export interface PremiumDictionaryDraft {
  id?: string;
  title: string;
  words: string[];
  source: CustomDictionaryCollection['source'];
  classLabel?: string;
  theme?: string;
}

type DictionaryCollectionsResponse = {
  collections?: unknown[];
};

type DictionaryCollectionResponse = {
  collection?: unknown;
  profile?: UserProfile | null;
};

const SCHEMA_NOT_READY_CODES = new Set(['PGRST202', '42P01', '42703', '42883']);
const SOURCES: CustomDictionaryCollection['source'][] = ['manual', 'ocr', 'class', 'topic'];
const schemaNotReady = (error: any): boolean => Boolean(error) && (
  SCHEMA_NOT_READY_CODES.has(String(error.code || ''))
  || /does not exist|could not find the function|schema cache|column .* does not exist/i.test(String(error.message || ''))
);

const normalizeWords = (words: string[]): string[] => normalizeEnglishWordArray(words);
const readString = (data: any, camel: string, snake?: string): string | undefined => {
  const value = typeof data?.[camel] === 'string' ? data[camel] : snake && typeof data?.[snake] === 'string' ? data[snake] : undefined;
  return value && value.trim() ? value : undefined;
};
const normalizeSource = (value: unknown, fallback: CustomDictionaryCollection['source'] = 'manual'): CustomDictionaryCollection['source'] => SOURCES.includes(value as CustomDictionaryCollection['source']) ? value as CustomDictionaryCollection['source'] : fallback;

const normalizeCollection = (data: any, draft: PremiumDictionaryDraft, words: string[]): CustomDictionaryCollection => ({
  id: String(data?.id || draft.id || crypto.randomUUID()),
  title: String(data?.title || draft.title || 'Новый словарь'),
  source: normalizeSource(data?.source, draft.source),
  words,
  classLabel: readString(data, 'classLabel', 'class_label') || draft.classLabel,
  theme: readString(data, 'theme') || draft.theme,
  createdAt: readString(data, 'createdAt', 'created_at') || new Date().toISOString(),
});
const normalizeStoredCollection = (data: any): CustomDictionaryCollection | null => {
  const words = normalizeWords(Array.isArray(data?.words) ? data.words.filter((item: unknown): item is string => typeof item === 'string') : []);
  if (!words.length) return null;
  return {
    id: String(data?.id || crypto.randomUUID()),
    title: readString(data, 'title') || 'Словарь для ученика',
    source: normalizeSource(data?.source),
    words,
    classLabel: readString(data, 'classLabel', 'class_label'),
    theme: readString(data, 'theme'),
    createdAt: readString(data, 'createdAt', 'created_at') || new Date().toISOString(),
  };
};

export const premiumDictionaryService = {
  async listCollections(): Promise<CustomDictionaryCollection[]> {
    if (isBackendApiConfigured) {
      const data = await backendApiRequest<DictionaryCollectionsResponse>('/api/profile/dictionary-collections');
      return (Array.isArray(data.collections) ? data.collections : [])
        .map(normalizeStoredCollection)
        .filter((item): item is CustomDictionaryCollection => Boolean(item));
    }

    const { data, error } = await supabase.rpc('list_my_dictionary_collections');
    if (error) {
      if (schemaNotReady(error)) return [];
      throw error;
    }
    return (Array.isArray(data) ? data : []).map(normalizeStoredCollection).filter((item): item is CustomDictionaryCollection => Boolean(item));
  },

  async saveCollection(draft: PremiumDictionaryDraft): Promise<CustomDictionaryCollection> {
    const words = normalizeWords(draft.words);
    if (!words.length) throw new Error('Добавьте хотя бы одно английское слово.');

    if (isBackendApiConfigured) {
      const data = await backendApiRequest<DictionaryCollectionResponse>('/api/profile/dictionary-collections', {
        method: 'POST',
        body: {
          id: draft.id || null,
          title: draft.title,
          words,
          source: draft.source,
          classLabel: draft.classLabel || null,
          theme: draft.theme || null,
        },
      });
      if (data.profile && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: data.profile }));
      }
      return normalizeCollection(data.collection, draft, words);
    }

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
