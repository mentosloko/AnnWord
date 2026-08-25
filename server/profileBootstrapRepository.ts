import type { UserProfile } from '../types';
import { mapProfileFromDB } from '../services/profileMapper';
import { query } from './db';
import { mergeAssignedWordsIntoProfile } from './profileHydration';
import { getOrCreateProfile } from './profileRepository';

export async function getBootstrapProfile(userId: string, username: string): Promise<UserProfile> {
  const result = await query(
    `select p.*,
            coalesce(latest_set.words, '{}'::text[]) as assigned_words,
            coalesce(latest_set.word_translations, '{}'::jsonb) as assigned_word_translations
       from profiles p
       left join lateral (
         select s.words, s.word_translations
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

  return mergeAssignedWordsIntoProfile(
    mapProfileFromDB(row),
    row.assigned_words,
    row.assigned_word_translations,
  );
}
