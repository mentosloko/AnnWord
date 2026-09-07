import type { PoolClient } from 'pg';
import type { GameRewardInput } from '../services/gamificationRules';
import { applyGameRewardToCharacter, calculateGameReward } from '../services/gamificationRules';
import { STARTER_CHARACTERS } from '../services/characterCatalog';
import { mapProfileFromDB, normalizePet, normalizeStats } from '../services/profileMapper';
import { applyServerPetMoodClock, markServerPetActivity } from '../services/serverPetMoodPolicy';
import type { PetState, UserProfile, UserStats } from '../types';
import { insertAnalyticsEvents, insertGameEvents } from './activityEventRepository';
import { query, transaction } from './db';
import { mergeAssignedWordsIntoProfile } from './profileHydration';
import { mergeStatsForSave, PROFILE_COLUMNS } from './profileRepository';

const AUTHORITATIVE_SOURCE = 'authoritative_game_result_v1';
const AUTHORITATIVE_EVENT_PREFIX = 'authoritative:';
const DAILY_QUEST_CLAIM_PREFIX = 'daily-quest:';
const DAILY_MAX_XP = 2500;
const DAILY_MAX_COINS = 150;
const MAX_ANAGRAM_REWARDS_PER_MINUTE = 40;
const MAX_SESSION_REWARDS_PER_MINUTE = 12;
const STARTER_TYPES = new Set(STARTER_CHARACTERS.map(character => character.type));
const MOSCOW_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
});

type RecordValue = Record<string, unknown>;
type AssignmentSnapshot = { words: unknown; translations: unknown };
interface LockedProfileRow extends RecordValue {
  id: string;
  role: string | null;
  account_mode: string | null;
  stats: unknown;
  pet: unknown;
  assigned_words: unknown;
  assigned_word_translations: unknown;
  server_now: Date | string;
}

export interface ClientRewardClaim {
  eventKey: string;
  input: GameRewardInput;
}

export interface AuthoritativeGameResult {
  profile: UserProfile;
  duplicate: boolean;
  input: GameRewardInput;
  sourceEventKey: string;
}

export interface AuthoritativeQuestSource {
  sourceEventKey: string;
  input: GameRewardInput;
}

const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeInteger = (value: unknown, min: number, max: number, label: string): number => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Некорректное значение: ${label}.`);
  const rounded = Math.round(number);
  if (rounded < min || rounded > max) throw new Error(`Недопустимое значение: ${label}.`);
  return rounded;
};
const bool = (value: unknown): boolean => value === true;
const moscowDateKey = (date: Date): string => {
  const parts = MOSCOW_DATE_FORMAT.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
};
const previousMoscowDateKey = (serverNowMs: number): string => moscowDateKey(new Date(serverNowMs - 86_400_000));
const serverNowMs = (row: LockedProfileRow): number => {
  const parsed = row.server_now instanceof Date ? row.server_now.getTime() : Date.parse(String(row.server_now));
  if (!Number.isFinite(parsed)) throw new Error('Сервер не вернул корректное время.');
  return parsed;
};

const assignmentsFromRow = (row: LockedProfileRow): AssignmentSnapshot => ({
  words: row.assigned_words,
  translations: row.assigned_word_translations,
});

const mapProfileWithAssignments = (row: unknown, assignments: AssignmentSnapshot): UserProfile => mergeAssignedWordsIntoProfile(
  mapProfileFromDB(row), assignments.words, assignments.translations,
);

const lockProfile = async (client: PoolClient, userId: string): Promise<LockedProfileRow> => {
  const result = await client.query<LockedProfileRow>(
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

export const sanitizeGameRewardInput = (raw: unknown): GameRewardInput => {
  if (!isRecord(raw) || typeof raw.type !== 'string') throw new Error('Некорректный результат игры.');
  const type = raw.type;
  if (type === 'wordle') throw new Error('Результат Классики должен сохраняться через защищённый Classic endpoint.');
  if (type === 'other') throw new Error('Неизвестный игровой режим не может выдавать награду.');
  if (Number(raw.coinsAdjustment || 0) !== 0 && type !== 'anagram') {
    throw new Error('Клиент не может изменять размер игровой награды.');
  }

  if (type === 'sprint') {
    return { type, guessedWords: safeInteger(raw.guessedWords ?? 0, 0, 60, 'результат Спринта') };
  }
  if (type === 'translation') {
    return { type, guessedWords: safeInteger(raw.guessedWords ?? 0, 0, 10, 'результат 1 из 2') };
  }
  if (type === 'letterSquare') {
    return { type, guessedWords: safeInteger(raw.guessedWords ?? 0, 0, 8, 'результат Змейки') };
  }
  if (type === 'memory') {
    const moves = raw.moves !== undefined
      ? safeInteger(raw.moves, 1, 100, 'ходы Памяти')
      : Math.max(1, Math.ceil(safeInteger(raw.clicks ?? 2, 2, 200, 'клики Памяти') / 2));
    return { type, moves };
  }
  if (type === 'hangman') {
    const maxMistakes = safeInteger(raw.maxMistakes ?? 7, 1, 12, 'лимит ошибок Виселицы');
    const mistakes = safeInteger(raw.mistakes ?? 0, 0, maxMistakes, 'ошибки Виселицы');
    return { type, won: bool(raw.won), mistakes, maxMistakes };
  }
  if (type === 'anagram') {
    const statsOnly = bool(raw.statsOnly);
    const guessedWords = statsOnly
      ? safeInteger(raw.guessedWords ?? 0, 0, 10_000, 'итог анаграмм')
      : safeInteger(raw.guessedWords ?? 0, 1, 1, 'угаданное слово анаграммы');
    return {
      type,
      guessedWords,
      statsOnly,
      wonForStats: statsOnly ? bool(raw.wonForStats) : undefined,
      coinsAdjustment: 0,
    };
  }
  throw new Error('Этот игровой режим не поддерживает серверную награду.');
};

export const extractClientRewardClaim = (rawEvents: unknown): ClientRewardClaim | null => {
  const events = Array.isArray(rawEvents) ? rawEvents.filter(isRecord) : [];
  const rewardEvent = events.find(event => String(event.eventType ?? event.event_type) === 'reward_granted');
  if (!rewardEvent) return null;
  const eventKey = typeof (rewardEvent.eventKey ?? rewardEvent.event_key) === 'string'
    ? String(rewardEvent.eventKey ?? rewardEvent.event_key).trim()
    : '';
  if (!/^[A-Za-z0-9:_.-]{8,500}$/.test(eventKey)) throw new Error('Некорректный идентификатор игровой награды.');
  const payload = isRecord(rewardEvent.payload) ? rewardEvent.payload : {};
  return { eventKey, input: sanitizeGameRewardInput(payload.input) };
};

const isStatWin = (input: GameRewardInput): boolean => {
  if ('wonForStats' in input && typeof input.wonForStats === 'boolean') return input.wonForStats;
  if (input.type === 'hangman') return input.won === true;
  if (input.type === 'memory') return Math.max(0, Math.round(input.moves || Math.ceil((input.clicks || 0) / 2))) > 0;
  if (input.type === 'sprint' || input.type === 'translation' || input.type === 'letterSquare' || input.type === 'anagram') {
    return Math.max(0, Math.round(input.guessedWords || 0)) > 0;
  }
  return false;
};

const applyGameStats = (rawStats: unknown, input: GameRewardInput): UserStats => {
  const stats = normalizeStats(rawStats);
  if (input.type === 'anagram' && !input.statsOnly) return stats;
  return {
    ...stats,
    gamesPlayed: Math.max(0, Math.round(stats.gamesPlayed || 0)) + 1,
    gamesWon: Math.max(0, Math.round(stats.gamesWon || 0)) + (isStatWin(input) ? 1 : 0),
  };
};

const sanitizeClientGameEvents = (rawEvents: unknown): unknown[] => Array.isArray(rawEvents)
  ? rawEvents.filter(isRecord).map(event => ({ ...event, coinsDelta: 0, coins_delta: 0, xpDelta: 0, xp_delta: 0 }))
  : [];

const anagramRewardCoins = async (client: PoolClient, userId: string): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `with boundary as (
       select coalesce(max(ge.id), 0) as boundary_id
         from game_events ge
        where ge.user_id = $1
          and ge.event_type = 'reward_granted'
          and ge.game_mode = 'anagram'
          and ge.event_key like 'authoritative:%'
          and ge.payload->>'source' = $2
          and ge.payload->'input'->>'statsOnly' = 'true'
     )
     select count(*)::text as count
       from game_events ge
       cross join boundary b
      where ge.user_id = $1
        and ge.event_type = 'reward_granted'
        and ge.game_mode = 'anagram'
        and ge.event_key like 'authoritative:%'
        and ge.payload->>'source' = $2
        and ge.id > b.boundary_id
        and coalesce(ge.payload->'input'->>'statsOnly', 'false') <> 'true'`,
    [userId, AUTHORITATIVE_SOURCE],
  );
  const count = Math.max(0, Number.parseInt(result.rows[0]?.count || '0', 10) || 0);
  return count > 0 && count % 10 === 0 ? 1 : 0;
};

const enforceRewardVelocity = async (
  client: PoolClient,
  userId: string,
  input: GameRewardInput,
  reward: { coins: number; xp: number },
): Promise<void> => {
  const result = await client.query<{ recent_mode_rewards: string; coins_today: string; xp_today: string }>(
    `select count(*) filter (
              where game_mode = $3
                and occurred_at >= now() - interval '60 seconds'
            )::text as recent_mode_rewards,
            coalesce(sum(greatest(coins_delta, 0)) filter (
              where occurred_at >= (date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow')
            ), 0)::text as coins_today,
            coalesce(sum(greatest(xp_delta, 0)) filter (
              where occurred_at >= (date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow')
            ), 0)::text as xp_today
       from game_events
      where user_id = $1
        and event_type = 'reward_granted'
        and event_key like 'authoritative:%'
        and payload->>'source' = $2`,
    [userId, AUTHORITATIVE_SOURCE, input.type],
  );
  const row = result.rows[0];
  const recentModeRewards = Math.max(0, Number.parseInt(row?.recent_mode_rewards || '0', 10) || 0);
  const coinsToday = Math.max(0, Number.parseInt(row?.coins_today || '0', 10) || 0);
  const xpToday = Math.max(0, Number.parseInt(row?.xp_today || '0', 10) || 0);
  const minuteLimit = input.type === 'anagram' ? MAX_ANAGRAM_REWARDS_PER_MINUTE : MAX_SESSION_REWARDS_PER_MINUTE;
  if (recentModeRewards > minuteLimit) throw new Error('Слишком много игровых наград за короткое время. Повторите позже.');
  if (coinsToday + Math.max(0, Math.round(reward.coins || 0)) > DAILY_MAX_COINS) {
    throw new Error('Достигнут дневной лимит игровых монет.');
  }
  if (xpToday + Math.max(0, Math.round(reward.xp || 0)) > DAILY_MAX_XP) {
    throw new Error('Достигнут дневной лимит игрового опыта.');
  }
};

export const applyAuthoritativeGameResult = async (
  userId: string,
  claim: ClientRewardClaim,
  analyticsEvents: unknown = [],
  clientGameEvents: unknown = [],
): Promise<AuthoritativeGameResult> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const assignments = assignmentsFromRow(row);
  const sourceEventKey = `${AUTHORITATIVE_EVENT_PREFIX}${claim.eventKey}`;
  const claimed = await client.query<{ id: string }>(
    `insert into game_events (
       user_id, event_key, event_type, game_mode, result, coins_delta, xp_delta, payload, occurred_at
     ) values ($1, $2, 'reward_granted', $3, 'granted', 0, 0, $4::jsonb, now())
     on conflict (event_key) do nothing
     returning id`,
    [userId, sourceEventKey, claim.input.type, JSON.stringify({ source: AUTHORITATIVE_SOURCE, input: claim.input })],
  );
  if (!claimed.rows[0]) {
    return { profile: mapProfileWithAssignments(row, assignments), duplicate: true, input: claim.input, sourceEventKey };
  }

  const baseReward = calculateGameReward({ ...claim.input, coinsAdjustment: 0 });
  const coins = claim.input.type === 'anagram' && !claim.input.statsOnly
    ? await anagramRewardCoins(client, userId)
    : baseReward.coins;
  const reward = { ...baseReward, coins };
  await enforceRewardVelocity(client, userId, claim.input, reward);
  const nowMs = serverNowMs(row);
  const clock = applyServerPetMoodClock(normalizePet(row.pet), nowMs);
  const progress = applyGameRewardToCharacter(clock.pet, reward);
  const today = moscowDateKey(new Date(nowMs));
  const nextPet = markServerPetActivity(progress.pet, today, previousMoscowDateKey(nowMs));
  const nextStats = applyGameStats(row.stats, claim.input);

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

  await client.query(
    `update game_events
        set coins_delta = $3,
            xp_delta = $4,
            payload = $5::jsonb
      where user_id = $1 and event_key = $2`,
    [
      userId,
      sourceEventKey,
      reward.coins,
      reward.xp,
      JSON.stringify({ source: AUTHORITATIVE_SOURCE, input: claim.input, reward: { coins: reward.coins, xp: reward.xp, label: reward.label } }),
    ],
  );
  await insertAnalyticsEvents(userId, analyticsEvents, 100, client);
  await insertGameEvents(userId, sanitizeClientGameEvents(clientGameEvents), 100, client);
  return { profile: mapProfileWithAssignments(updated.rows[0], assignments), duplicate: false, input: claim.input, sourceEventKey };
});

export const updateCharacterIdentityServerAuthoritative = async (userId: string, rawPet: unknown): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const assignments = assignmentsFromRow(row);
  const current = normalizePet(row.pet);
  const incoming = isRecord(rawPet) ? rawPet : {};
  const requestedName = typeof incoming.name === 'string' ? incoming.name.trim().slice(0, 40) : current.name;
  const requestedType = typeof incoming.type === 'string' ? incoming.type.trim() : current.type;
  const completingOnboarding = current.characterOnboarded !== true && incoming.characterOnboarded === true;
  if (completingOnboarding && !STARTER_TYPES.has(requestedType)) throw new Error('Неизвестный персонаж.');
  const next: PetState = normalizePet({
    ...current,
    name: requestedName || current.name,
    type: completingOnboarding ? requestedType : current.type,
    characterOnboarded: current.characterOnboarded === true || completingOnboarding,
  });
  const updated = await client.query(
    `update profiles set pet = $2::jsonb, updated_at = now() where id = $1 returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(next)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return mapProfileWithAssignments(updated.rows[0], assignments);
});

export const updateKidsWordStatsWithoutGameCounters = async (userId: string, incomingStats: unknown): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const assignments = assignmentsFromRow(row);
  const current = normalizeStats(row.stats);
  const merged = mergeStatsForSave(row.stats, incomingStats);
  const safeStats: UserStats = { ...merged, gamesPlayed: current.gamesPlayed, gamesWon: current.gamesWon };
  const updated = await client.query(
    `update profiles set stats = $2::jsonb, updated_at = now() where id = $1 returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(safeStats)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return mapProfileWithAssignments(updated.rows[0], assignments);
});

export const isKidsAccount = async (userId: string): Promise<boolean> => {
  const result = await query<{ role: string | null; account_mode: string | null }>(
    `select role, account_mode from profiles where id = $1`, [userId],
  );
  const row = result.rows[0];
  return row?.role === 'parent' || row?.account_mode === 'parent';
};

export const getLatestAuthoritativeQuestSource = async (userId: string): Promise<AuthoritativeQuestSource | null> => {
  const result = await query<{ event_key: string; payload: unknown }>(
    `select event_key, payload
       from game_events
      where user_id = $1
        and event_type = 'reward_granted'
        and event_key like 'authoritative:%'
        and payload->>'source' = $2
        and occurred_at >= now() - interval '30 minutes'
      order by id desc
      limit 1`,
    [userId, AUTHORITATIVE_SOURCE],
  );
  const row = result.rows[0];
  if (!row || !isRecord(row.payload)) return null;
  return { sourceEventKey: row.event_key, input: sanitizeGameRewardInput(row.payload.input) };
};

export const claimDailyQuestSource = async (userId: string, sourceEventKey: string): Promise<boolean> => {
  if (!sourceEventKey.startsWith(AUTHORITATIVE_EVENT_PREFIX)) return false;
  const eventKey = `${DAILY_QUEST_CLAIM_PREFIX}${sourceEventKey}`;
  const result = await query<{ id: string }>(
    `insert into game_events (user_id, event_key, event_type, result, coins_delta, xp_delta, payload, occurred_at)
     values ($1, $2, 'daily_quest_source_claim', 'accepted', 0, 0, $3::jsonb, now())
     on conflict (event_key) do nothing
     returning id`,
    [userId, eventKey, JSON.stringify({ source: 'authoritative_daily_quest_v1', sourceEventKey })],
  );
  return Boolean(result.rows[0]);
};
