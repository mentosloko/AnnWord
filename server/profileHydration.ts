import type { PoolClient } from 'pg';
import type { UserProfile } from '../types';
import { normalizeDictionaryTranslations } from '../services/masterDictionaryLookup';
import { query } from './db';
import { measureServerTiming } from './performanceTelemetry';

const cleanWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === 'string').map(word => word.trim().toUpperCase()).filter(Boolean)))
  : [];

export const mergeAssignedWordsIntoProfile = (profile: UserProfile, rawWords: unknown, rawTranslations: unknown = {}): UserProfile => {
  const assignedWords = cleanWords(rawWords);
  const normalizedTranslations = normalizeDictionaryTranslations(rawTranslations);
  const assignedWordTranslations = Object.fromEntries(
    assignedWords.filter(word => normalizedTranslations[word]).map(word => [word, normalizedTranslations[word]]),
  );
  if (!assignedWords.length) return { ...profile, assignedWords: [], assignedWordTranslations: {} };
  return {
    ...profile,
    assignedWords,
    assignedWordTranslations,
    customDictionaryEn: Array.from(new Set([...(profile.customDictionaryEn || []), ...assignedWords])),
  };
};

export const hydrateProfileAssignments = async (
  userId: string,
  profile: UserProfile,
  client?: Pick<PoolClient, 'query'>,
): Promise<UserProfile> => measureServerTiming('hydrate', async () => {
  const sql = `select coalesce(words, '{}') as words,
                      coalesce(word_translations, '{}'::jsonb) as word_translations
                 from assigned_word_sets
                where learner_user_id = $1
                  and archived_at is null
                order by created_at desc
                limit 1`;
  const result = client
    ? await client.query<{ words: string[]; word_translations: unknown }>(sql, [userId])
    : await query<{ words: string[]; word_translations: unknown }>(sql, [userId]);
  return mergeAssignedWordsIntoProfile(profile, result.rows[0]?.words, result.rows[0]?.word_translations);
});
