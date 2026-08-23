import type { PoolClient } from 'pg';
import type { UserProfile } from '../types';
import { query } from './db';
import { measureServerTiming } from './performanceTelemetry';

const cleanWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

export const mergeAssignedWordsIntoProfile = (profile: UserProfile, rawWords: unknown): UserProfile => {
  const assignedWords = cleanWords(rawWords);
  if (!assignedWords.length) return { ...profile, assignedWords: [] };
  return {
    ...profile,
    assignedWords,
    customDictionaryEn: Array.from(new Set([...(profile.customDictionaryEn || []), ...assignedWords])),
  };
};

export const hydrateProfileAssignments = async (
  userId: string,
  profile: UserProfile,
  client?: Pick<PoolClient, 'query'>,
): Promise<UserProfile> => measureServerTiming('hydrate', async () => {
  const result = client
    ? await client.query<{ words: string[] }>(
      `select coalesce(words, '{}') as words
         from assigned_word_sets
        where learner_user_id = $1
          and archived_at is null
        order by created_at desc
        limit 1`,
      [userId],
    )
    : await query<{ words: string[] }>(
      `select coalesce(words, '{}') as words
         from assigned_word_sets
        where learner_user_id = $1
          and archived_at is null
        order by created_at desc
        limit 1`,
      [userId],
    );
  return mergeAssignedWordsIntoProfile(profile, result.rows[0]?.words);
});
