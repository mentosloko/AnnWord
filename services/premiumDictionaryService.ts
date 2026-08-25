import type { CustomDictionaryCollection, UserProfile } from '../types';
import { backendApiRequest } from './backendApiClient';
import { normalizeDictionaryTranslations } from './masterDictionaryLookup';
import { dispatchOwnedProfileUpdate, getCurrentProfileOwnerId } from './profileUpdateEvent';

export interface PremiumDictionaryDraft {
  id?: string;
  title: string;
  words: string[];
  wordTranslations?: Record<string, string>;
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

const SOURCES: CustomDictionaryCollection['source'][] = ['manual', 'ocr', 'class', 'topic'];
const normalizeWords = (words: string[]): string[] => Array.from(new Set(
  words.map(word => word.trim().toUpperCase()).filter(word => /^[A-Z][A-Z'-]{1,}$/.test(word)),
));
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
  wordTranslations: normalizeDictionaryTranslations(data?.wordTranslations || data?.word_translations || draft.wordTranslations),
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
    wordTranslations: normalizeDictionaryTranslations(data?.wordTranslations || data?.word_translations),
    classLabel: readString(data, 'classLabel', 'class_label'),
    theme: readString(data, 'theme'),
    createdAt: readString(data, 'createdAt', 'created_at') || new Date().toISOString(),
  };
};

export const premiumDictionaryService = {
  async listCollections(): Promise<CustomDictionaryCollection[]> {
    const data = await backendApiRequest<DictionaryCollectionsResponse>('/api/profile/dictionary-collections');
    return (Array.isArray(data.collections) ? data.collections : [])
      .map(normalizeStoredCollection)
      .filter((item): item is CustomDictionaryCollection => Boolean(item));
  },

  async saveCollection(draft: PremiumDictionaryDraft): Promise<CustomDictionaryCollection> {
    const ownerUserId = getCurrentProfileOwnerId();
    const words = normalizeWords(draft.words);
    if (!words.length) throw new Error('Добавьте хотя бы одно английское слово.');

    const data = await backendApiRequest<DictionaryCollectionResponse>('/api/profile/dictionary-collections', {
      method: 'POST',
      body: {
        id: draft.id || null,
        title: draft.title,
        words,
        wordTranslations: normalizeDictionaryTranslations(draft.wordTranslations),
        source: draft.source,
        classLabel: draft.classLabel || null,
        theme: draft.theme || null,
      },
    });
    if (data.profile) dispatchOwnedProfileUpdate(ownerUserId, data.profile);
    return normalizeCollection(data.collection, draft, words);
  },
};
