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
    stats,
    assignedWords: normalizeAssignedWords(value?.assigned_words),
    weeklyAccuracy: gamesPlayed ? Math.round(gamesWon / gamesPlayed * 100) : 0,
    lastActiveAt: typeof value?.last_active_at === 'string' ? value.last_active_at : undefined,
  };
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

  async assignWords(learnerId: string, words: string[], title = 'Слова для тренировки'): Promise<void> {
    const normalized = normalizeAssignedWords(words);
    if (!normalized.length) throw new Error('Добавьте хотя бы одно английское слово.');
    const { error } = await supabase.from('assigned_word_sets').insert({
      learner_user_id: learnerId,
      title,
      source: 'manual',
      words: normalized,
    });
    if (error) {
      if (schemaNotReady(error)) throw new Error('Сохранение назначений станет доступно после подключения схемы комнаты взрослого.');
      throw error;
    }
  },

  async saveWeeklyReportSubscription(learnerId: string, email: string, enabled: boolean): Promise<void> {
    const { error } = await supabase.from('weekly_report_subscriptions').upsert({
      learner_user_id: learnerId,
      email,
      enabled,
      weekday: 1,
    }, { onConflict: 'adult_user_id,learner_user_id' });
    if (error) {
      if (schemaNotReady(error)) throw new Error('Отправка отчётов станет доступна после подключения схемы комнаты взрослого.');
      throw error;
    }
  },
};
