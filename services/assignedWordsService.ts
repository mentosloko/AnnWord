import { backendApiRequest, isBackendApiConfigured } from './backendApiClient';

export interface AssignedWordSet {
  id: string;
  title: string;
  classLabel?: string | null;
  theme?: string | null;
  source: string;
  words: string[];
  createdAt?: string;
}

export interface AssignedWordsLoadResult {
  sets: AssignedWordSet[];
  words: string[];
}

const normalizeWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

const normalizeSet = (value: any): AssignedWordSet | null => {
  const words = normalizeWords(value?.words);
  if (!words.length) return null;
  return {
    id: String(value?.id || ''),
    title: String(value?.title || 'Назначенный словарь'),
    classLabel: typeof value?.classLabel === 'string' ? value.classLabel : typeof value?.class_label === 'string' ? value.class_label : null,
    theme: typeof value?.theme === 'string' ? value.theme : null,
    source: String(value?.source || 'manual'),
    words,
    createdAt: typeof value?.createdAt === 'string' ? value.createdAt : typeof value?.created_at === 'string' ? value.created_at : undefined,
  };
};

export const assignedWordsService = {
  async loadAssignedWords(): Promise<AssignedWordsLoadResult> {
    if (!isBackendApiConfigured) return { sets: [], words: [] };
    const data = await backendApiRequest<{ sets?: unknown[]; words?: unknown[] }>('/api/profile/assigned-words');
    const sets = (Array.isArray(data.sets) ? data.sets : []).map(normalizeSet).filter((set): set is AssignedWordSet => Boolean(set));
    const words = normalizeWords(data.words).length ? normalizeWords(data.words) : Array.from(new Set(sets.flatMap(set => set.words))).sort();
    return { sets, words };
  },
};
