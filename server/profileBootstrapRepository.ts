import type { UserProfile } from '../types';
import { mapProfileFromDB } from '../services/profileMapper';
import { query } from './db';
import { getOrCreateProfile } from './profileRepository';

const cleanWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

export async function getBootstrapProfile(userId: string, username: string): Promise<UserProfile> {
  const result = await query(
    `select p.*,
            coalesce(latest_set.words, '{}'::text[]) as assigned_words
       from profiles p
       left join lateral (
         select s.words
           from assigned_word_sets s
          where s.learner_user_id = p.id
            and s.archived_at is null
          order by s.created_at desc
          limit 1
       ) latest_set on true
      where p.id = $1
      limit 1`,
    [userId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return getOrCreateProfile(userId, username);

  const profile = mapProfileFromDB(row);
  const assignedWords = cleanWords(row.assigned_words);
  if (!assignedWords.length) return profile;
  return {
    ...profile,
    assignedWords,
    customDictionaryEn: Array.from(new Set([...(profile.customDictionaryEn || []), ...assignedWords])),
  };
}
