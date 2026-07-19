import { supabase } from '../supabase';
import { ManagedLearner, UserStats } from '../types';
import { backendApiRequest, isBackendApiConfigured } from './backendApiClient';
import { normalizeStats } from './profileMapper';

export interface MentorRoomLoadResult {
  learners: ManagedLearner[];
  backendReady: boolean;
}

type BackendLearnersResponse = {
  learners?: unknown[];
  backendReady?: boolean;
};

type CachedLearnersPayload = {
  savedAt: number;
  result: MentorRoomLoadResult;
};

const SCHEMA_NOT_READY_CODES = new Set(['PGRST202', '42P01', '42703', '42883']);
const LEARNERS_CACHE_KEY = 'annword_mentor_learners_v1';
const LEARNERS_CACHE_TTL_MS = 30_000;
let memoryCache: CachedLearnersPayload | null = null;
let pendingLoad: Promise<MentorRoomLoadResult> | null = null;

const schemaNotReady = (error: any): boolean => Boolean(error) && (
  SCHEMA_NOT_READY_CODES.has(String(error.code || ''))
  || /does not exist|could not find the function|schema cache|column .* does not exist/i.test(String(error.message || ''))
);

const normalizeAssignedWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

const mapLearner = (value: any): ManagedLearner => {
  const stats: UserStats = normalizeStats(value?.stats);
  const gamesPlayed = Math.max(0, stats.gamesPlayed || 0);
  const gamesWon = Math.max(0, stats.gamesWon || 0);
  return {
    id: String(value?.id || ''),
    name: String(value?.name || 'Ученик'),
    classLabel: typeof value?.classLabel === 'string' ? value.classLabel : typeof value?.class_label === 'string' ? value.class_label : undefined,
    childShareCode: typeof value?.childShareCode === 'string' ? value.childShareCode : typeof value?.child_share_code === 'string' ? value.child_share_code : undefined,
    stats,
    assignedWords: normalizeAssignedWords(value?.assignedWords || value?.assigned_words),
    weeklyAccuracy: gamesPlayed ? Math.round(gamesWon / gamesPlayed * 100) : 0,
    lastActiveAt: typeof value?.lastActiveAt === 'string' ? value.lastActiveAt : typeof value?.last_active_at === 'string' ? value.last_active_at : undefined,
  };
};

export const normalizeMentorRoomResult = (data: BackendLearnersResponse): MentorRoomLoadResult => ({
  learners: Array.isArray(data.learners) ? data.learners.map(mapLearner).filter(learner => learner.id) : [],
  backendReady: data.backendReady !== false,
});

const isFresh = (payload: CachedLearnersPayload | null): payload is CachedLearnersPayload => Boolean(payload && Date.now() - payload.savedAt < LEARNERS_CACHE_TTL_MS);

const readSessionCache = (): CachedLearnersPayload | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(LEARNERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLearnersPayload;
    return parsed && Number.isFinite(parsed.savedAt) && parsed.result ? parsed : null;
  } catch {
    return null;
  }
};

const writeCache = (result: MentorRoomLoadResult): MentorRoomLoadResult => {
  const payload = { savedAt: Date.now(), result };
  memoryCache = payload;
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(LEARNERS_CACHE_KEY, JSON.stringify(payload)); } catch { /* cache must not block the room */ }
  }
  return result;
};

const clearCache = (): void => {
  memoryCache = null;
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(LEARNERS_CACHE_KEY); } catch { /* ignore */ }
  }
};

const writeError = (error: any, fallback: string): never => {
  if (schemaNotReady(error)) throw new Error(fallback);
  throw new Error(String(error?.message || fallback));
};

const requestLearners = async (): Promise<MentorRoomLoadResult> => {
  if (isBackendApiConfigured) {
    const data = await backendApiRequest<BackendLearnersResponse>('/api/mentor/learners');
    return normalizeMentorRoomResult(data);
  }

  const { data, error } = await supabase.rpc('get_managed_learner_word_stats');
  if (error) {
    if (schemaNotReady(error)) return { learners: [], backendReady: false };
    throw error;
  }
  return normalizeMentorRoomResult({ learners: Array.isArray(data) ? data : [], backendReady: true });
};

export const mentorRoomService = {
  primeLearners: (result: MentorRoomLoadResult): MentorRoomLoadResult => writeCache(result),

  clearLearnersCache: clearCache,

  async loadLearners(force = false): Promise<MentorRoomLoadResult> {
    if (!force) {
      if (isFresh(memoryCache)) return memoryCache.result;
      const sessionCache = readSessionCache();
      if (isFresh(sessionCache)) {
        memoryCache = sessionCache;
        return sessionCache.result;
      }
      if (pendingLoad) return pendingLoad;
    }

    pendingLoad = requestLearners().then(writeCache).finally(() => { pendingLoad = null; });
    return pendingLoad;
  },

  async connectByChildCode(code: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) throw new Error('Введите код ребёнка.');

    if (isBackendApiConfigured) {
      await backendApiRequest<{ ok: boolean }>('/api/mentor/connect', {
        method: 'POST',
        body: { code: normalized },
      });
      clearCache();
      return;
    }

    const { error } = await supabase.rpc('connect_teacher_to_child_by_code', { p_child_code: normalized });
    if (error) writeError(error, 'Подключение по коду станет доступно после применения новой схемы.');
    clearCache();
  },

  async assignCollection(learnerId: string, collectionId: string): Promise<void> {
    if (!collectionId) throw new Error('Выберите сохранённый словарь.');

    if (isBackendApiConfigured) {
      await backendApiRequest<{ ok: boolean }>('/api/mentor/assign', {
        method: 'POST',
        body: { learnerId, collectionId },
      });
      clearCache();
      return;
    }

    const { error } = await supabase.rpc('assign_dictionary_collection_to_learner', {
      p_learner_user_id: learnerId,
      p_collection_id: collectionId,
    });
    if (error) writeError(error, 'Назначение словаря станет доступно после применения новой схемы.');
    clearCache();
  },
};
