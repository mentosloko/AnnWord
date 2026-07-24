import type { UserProfile } from '../types';
import { query } from './db';

const cleanWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

export const hydrateProfileAssignments = async (userId: string, profile: UserProfile): Promise<UserProfile> => {
  const result = await query<{ words: string[] }>(
    `select coalesce(words, '{}') as words
       from assigned_word_sets
      where learner_user_id = $1
        and archived_at is null
      order by created_at desc
      limit 1`,
    [userId],
  );
  const assignedWords = cleanWords(result.rows[0]?.words);
  if (!assignedWords.length) return { ...profile, assignedWords: [] };
  return {
    ...profile,
    assignedWords,
    customDictionaryEn: Array.from(new Set([...(profile.customDictionaryEn || []), ...assignedWords])),
  };
};
