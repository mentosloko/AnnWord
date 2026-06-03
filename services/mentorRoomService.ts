import { supabase } from '../supabase';
import { ManagedLearner, UserStats } from '../types';
import { normalizeStats } from './profileMapper';

export interface MentorRoomLoadResult {
  learners: ManagedLearner[];
  backendReady: boolean;
}

const SCHEMA_NOT_READY_CODES = new Set(['PGRST202', '42P01', '42703', '42883']);
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
    classLabel: typeof value?.class_label === 'string' ? value.class_label : undefined,
    childShareCode: typeof value?.child_share_code === 'string' ? value.child_share_code : undefined,
    stats,
    assignedWords: normalizeAssignedWords(value?.assigned_words),
    weeklyAccuracy: gamesPlayed ? Math.round(gamesWon / gamesPlayed * 100) : 0,
    lastActiveAt: typeof value?.last_active_at === 'string' ? value.last_active_at : undefined,
  };
};

const writeError = (error: any, fallback: string): never => {
  if (schemaNotReady(error)) throw new Error(fallback);
  throw new Error(String(error?.message || fallback));
};

export const mentorRoomService = {
  async loadLearners(): Promise<MentorRoomLoadResult> {
    const { data, error } = await supabase.rpc('get_managed_learner_word_stats');
    if (error) {
      if (schemaNotReady(error)) return { learners: [], backendReady: false };
      throw error;
    }
    return { learners: Array.isArray(data) ? data.map(mapLearner).filter(learner => learner.id) : [], backendReady: true };
  },

  async connectByChildCode(code: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) throw new Error('Введите код ребёнка.');
    const { error } = await supabase.rpc('connect_teacher_to_child_by_code', { p_child_code: normalized });
    if (error) writeError(error, 'Подключение по коду станет доступно после применения новой схемы.');
  },

  async assignCollection(learnerId: string, collectionId: string): Promise<void> {
    if (!collectionId) throw new Error('Выберите сохранённый словарь.');
    const { error } = await supabase.rpc('assign_dictionary_collection_to_learner', {
      p_learner_user_id: learnerId,
      p_collection_id: collectionId,
    });
    if (error) writeError(error, 'Назначение словаря станет доступно после применения новой схемы.');
  },
};
