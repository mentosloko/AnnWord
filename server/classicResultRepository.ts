import type { PoolClient } from 'pg';
import type { UserProfile, UserStats, WordLearningHistory } from '../types';
import { applyGameRewardToCharacter, calculateGameReward } from '../services/gamificationRules';
import { updateReviewPriorities, type WordPracticeResult } from '../services/gameSessionEngine';
import { mapProfileFromDB, normalizePet, normalizeStats } from '../services/profileMapper';
import { applyServerPetMoodClock, markServerPetActivity } from '../services/serverPetMoodPolicy';
import { transaction } from './db';
import { mergeAssignedWordsIntoProfile } from './profileHydration';
import { PROFILE_COLUMNS } from './profileRepository';

interface LockedClassicProfileRow {
  stats: unknown;
  pet: unknown;
  assigned_words: unknown;
  assigned_word_translations: unknown;
  server_now: Date | string;
  [key: string]: unknown;
}

export interface ClassicResultDelta {
  operationId: string;
  word: string;
  won: boolean;
  coinsAdjustment?: number;
}

export interface ClassicProfileCommitResult {
  profile: UserProfile;
  duplicate: boolean;
}

const MAX_WORD_HISTORY_EVENTS = 80;
const MOSCOW_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const moscowDateKey = (date: Date): string => {
  const parts = MOSCOW_DATE_FORMAT.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
};

const previousMoscowDateKey = (serverNowMs: number): string => moscowDateKey(new Date(serverNowMs - 86_400_000));
const normalizePracticeWord = (word: string): string => word.trim().toUpperCase();

const serverNowMs = (row: LockedClassicProfileRow): number => {
  const parsed = row.server_now instanceof Date ? row.server_now.getTime() : Date.parse(String(row.server_now));
  if (!Number.isFinite(parsed)) throw new Error('Сервер не вернул корректное время.');
  return parsed;
};

const mapProfileWithAssignments = (row: unknown, assignments: Pick<LockedClassicProfileRow, 'assigned_words' | 'assigned_word_translations'>): UserProfile => {
  return mergeAssignedWordsIntoProfile(
    mapProfileFromDB(row),
    assignments.assigned_words,
    assignments.assigned_word_translations,
  );
};

const lockProfile = async (client: PoolClient, userId: string): Promise<LockedClassicProfileRow> => {
  const result = await client.query<LockedClassicProfileRow>(
    `select p.*,
            coalesce(latest_set.words, '{}'::text[]) as assigned_words,
            coalesce(latest_set.word_translations, '{}'::jsonb) as assigned_word_translations,
            now() as server_now
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
      for update of p`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Профиль не найден.');
  return row;
};

const updateWordLearningHistory = (
  stats: UserStats,
  word: string,
  result: WordPracticeResult,
  nextReview: Record<string, number>,
  at: string,
): Record<string, WordLearningHistory> => {
  const mastered = result === 'mastered';
  const previous = stats.wordLearningHistory?.[word] || {
    word,
    mistakeCount: 0,
    resolvedCount: 0,
    currentReviewPriority: Math.max(0, Math.round(Number(stats.wordsToReview?.[word] || 0))),
    events: [],
  };
  const previousPriority = Math.max(0, Math.round(Number(stats.wordsToReview?.[word] ?? previous.currentReviewPriority ?? 0)));
  const nextPriority = Math.max(0, Math.round(nextReview[word] || 0));
  const wasDifficult = previousPriority > 0 || previous.mistakeCount > 0;
  const eventType = mastered ? (wasDifficult ? 'resolved' : 'mastered') : 'mistake';
  const nextEvents = [...(previous.events || []), { at, type: eventType, reviewPriorityAfter: nextPriority }].slice(-MAX_WORD_HISTORY_EVENTS);
  return {
    ...(stats.wordLearningHistory || {}),
    [word]: {
      ...previous,
      word,
      firstMistakeAt: !mastered && !previous.firstMistakeAt ? at : previous.firstMistakeAt,
      lastMistakeAt: mastered ? previous.lastMistakeAt : at,
      lastResolvedAt: mastered && wasDifficult ? at : previous.lastResolvedAt,
      mistakeCount: previous.mistakeCount + (mastered ? 0 : 1),
      resolvedCount: previous.resolvedCount + (mastered && wasDifficult ? 1 : 0),
      currentReviewPriority: nextPriority,
      events: nextEvents,
    },
  };
};

const applyClassicWordDelta = (rawStats: unknown, wordRaw: string, won: boolean): UserStats => {
  const stats = normalizeStats(rawStats);
  const word = normalizePracticeWord(wordRaw);
  if (!word) return stats;
  const result: WordPracticeResult = won ? 'mastered' : 'failed';
  const now = new Date().toISOString();
  const previousPerformance = stats.wordPerformance?.[word] || { word, attempts: 0, correct: 0, mistakes: 0 };
  const wordsGuessed = { ...stats.wordsGuessed };
  if (won) wordsGuessed[word] = (wordsGuessed[word] || 0) + 1;
  const currentReview = Object.fromEntries(
    Object.entries(stats.wordsToReview || {}).map(([key, value]) => [key, Math.max(0, Math.round(Number(value || 0)))]),
  );
  const wordsToReview = updateReviewPriorities(currentReview, word, result);
  return {
    ...stats,
    gamesPlayed: Math.max(0, Math.round(stats.gamesPlayed || 0)) + 1,
    gamesWon: Math.max(0, Math.round(stats.gamesWon || 0)) + (won ? 1 : 0),
    wordsGuessed,
    wordsToReview,
    wordLearningHistory: updateWordLearningHistory(stats, word, result, wordsToReview, now),
    wordPerformance: {
      ...(stats.wordPerformance || {}),
      [word]: {
        ...previousPerformance,
        attempts: previousPerformance.attempts + 1,
        correct: previousPerformance.correct + (won ? 1 : 0),
        mistakes: previousPerformance.mistakes + (won ? 0 : 1),
        lastPracticedAt: now,
      },
    },
  };
};

const safeCoinsAdjustment = (value: unknown): number => Math.max(-5, Math.min(0, Math.round(Number(value || 0))));

export const applyClassicResultIdempotently = async (
  userId: string,
  delta: ClassicResultDelta,
): Promise<ClassicProfileCommitResult> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const assignments = {
    assigned_words: row.assigned_words,
    assigned_word_translations: row.assigned_word_translations,
  };
  const word = normalizePracticeWord(delta.word);
  if (!word) throw new Error('Не указано слово для результата Классики.');

  const input = {
    type: 'wordle' as const,
    won: delta.won === true,
    coinsAdjustment: safeCoinsAdjustment(delta.coinsAdjustment),
  };
  const reward = calculateGameReward(input);
  const eventKey = `classic-result:${userId}:${delta.operationId}`;
  const claim = await client.query<{ id: string }>(
    `insert into game_events (
       user_id, event_key, event_type, game_mode, word, result,
       coins_delta, xp_delta, payload, occurred_at
     ) values ($1, $2, 'game_finished', 'wordle', $3, $4, 0, 0, $5::jsonb, now())
     on conflict (event_key) do nothing
     returning id`,
    [
      userId,
      eventKey,
      word,
      delta.won ? 'won' : 'lost',
      JSON.stringify({ source: 'classic_result_idempotency_v1', operationId: delta.operationId }),
    ],
  );

  if (!claim.rows[0]) {
    return { profile: mapProfileWithAssignments(row, assignments), duplicate: true };
  }

  const nowMs = serverNowMs(row);
  const clock = applyServerPetMoodClock(normalizePet(row.pet), nowMs);
  const progress = applyGameRewardToCharacter(clock.pet, reward);
  const today = moscowDateKey(new Date(nowMs));
  const nextPet = markServerPetActivity(progress.pet, today, previousMoscowDateKey(nowMs));
  const nextStats = applyClassicWordDelta(row.stats, word, delta.won === true);
  const updated = await client.query(
    `update profiles
        set stats = $2::jsonb,
            pet = $3::jsonb,
            coins = greatest(0, coins + $4::integer),
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(nextStats), JSON.stringify(nextPet), reward.coins],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return { profile: mapProfileWithAssignments(updated.rows[0], assignments), duplicate: false };
});
