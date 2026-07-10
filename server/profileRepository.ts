import type { PoolClient } from "pg";
import { query } from "./db";
import { mapProfileFromDB, normalizeDictionaryField, normalizeInventory, normalizePet, normalizeStats } from "../services/profileMapper";
import type { PetState, UserProfile, UserStats } from "../types";

export const PROFILE_COLUMNS = `
  id,
  username,
  role,
  account_mode,
  subscription_tier,
  premium_expires_at,
  feature_flags,
  dictionary_collections,
  weekly_report_email,
  child_display_name,
  child_share_code,
  child_slots_limit,
  custom_dictionary_en,
  stats,
  pet,
  coins,
  inventory
`;

const DEFAULT_PET: PetState = {
  name: "Щенок",
  type: "Puppy",
  level: 1,
  mood: "happy",
  xp: 0,
  moodScore: 60,
  stage: "stage_1",
  characterOnboarded: false,
  hunger: 60,
  energy: 60,
  equippedAccessories: [],
};

const DEFAULT_STATS: UserStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  wordsGuessed: {},
  wordsToReview: {},
  wordPerformance: {},
  wordLearningHistory: {},
};

const cleanWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === "string").map((word) => word.trim().toUpperCase()).filter(Boolean)))
  : [];

const mergeNumberMaps = (current: Record<string, number> = {}, incoming: Record<string, number> = {}): Record<string, number> => {
  const next = { ...current };
  Object.entries(incoming).forEach(([key, value]) => {
    next[key] = Math.max(Math.round(next[key] || 0), Math.round(value || 0));
  });
  return next;
};

const mergeStatsForSave = (currentRaw: unknown, incomingRaw: unknown): UserStats => {
  const current = normalizeStats(currentRaw || DEFAULT_STATS);
  const incoming = normalizeStats(incomingRaw || DEFAULT_STATS);
  return {
    ...current,
    ...incoming,
    gamesPlayed: Math.max(current.gamesPlayed || 0, incoming.gamesPlayed || 0),
    gamesWon: Math.max(current.gamesWon || 0, incoming.gamesWon || 0),
    wordsGuessed: mergeNumberMaps(current.wordsGuessed, incoming.wordsGuessed),
    wordsToReview: mergeNumberMaps(current.wordsToReview || {}, incoming.wordsToReview || {}),
    wordPerformance: {
      ...(current.wordPerformance || {}),
      ...(incoming.wordPerformance || {}),
    },
    wordLearningHistory: {
      ...(current.wordLearningHistory || {}),
      ...(incoming.wordLearningHistory || {}),
    },
  };
};

const mergePetForSave = (currentRaw: unknown, incomingRaw: unknown): PetState => {
  const current = normalizePet(currentRaw || DEFAULT_PET);
  const incoming = normalizePet(incomingRaw || DEFAULT_PET);
  return {
    ...current,
    ...incoming,
    xp: Math.max(current.xp || 0, incoming.xp || 0),
    level: Math.max(current.level || 1, incoming.level || 1),
    characterOnboarded: current.characterOnboarded === true || incoming.characterOnboarded === true,
    equippedAccessories: Array.from(new Set([...(current.equippedAccessories || []), ...(incoming.equippedAccessories || [])])),
    earnedStickerIds: Array.from(new Set([...(current.earnedStickerIds || []), ...(incoming.earnedStickerIds || [])])),
  };
};

async function addAssignedWords(userId: string, profile: UserProfile): Promise<UserProfile> {
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
  if (!assignedWords.length) return profile;
  return {
    ...profile,
    assignedWords,
    customDictionaryEn: Array.from(new Set([...(profile.customDictionaryEn || []), ...assignedWords])),
  };
}

async function mapProfile(userId: string, row: unknown): Promise<UserProfile> {
  return addAssignedWords(userId, mapProfileFromDB(row));
}

export async function getProfileById(userId: string): Promise<UserProfile | null> {
  const result = await query(`select ${PROFILE_COLUMNS} from profiles where id = $1`, [userId]);
  const row = result.rows[0];
  return row ? mapProfile(userId, row) : null;
}

export async function createProfileForUser(client: PoolClient, userId: string, username: string, role: "admin" | "user" = "user"): Promise<UserProfile> {
  const result = await client.query(
    `insert into profiles (
       id,
       username,
       role,
       account_mode,
       custom_dictionary_en,
       stats,
       pet,
       coins,
       inventory,
       feature_flags
     ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10::jsonb)
     returning ${PROFILE_COLUMNS}`,
    [
      userId,
      username,
      role,
      role === "admin" ? "player" : null,
      JSON.stringify([]),
      JSON.stringify(DEFAULT_STATS),
      JSON.stringify(DEFAULT_PET),
      0,
      JSON.stringify([]),
      JSON.stringify({}),
    ],
  );

  return mapProfileFromDB(result.rows[0]);
}

export async function getOrCreateProfile(userId: string, username: string): Promise<UserProfile> {
  const existing = await getProfileById(userId);
  if (existing) {
    return existing;
  }

  const result = await query(
    `insert into profiles (id, username, custom_dictionary_en, stats, pet, coins, inventory, feature_flags)
     values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8::jsonb)
     on conflict (id) do update set username = profiles.username
     returning ${PROFILE_COLUMNS}`,
    [
      userId,
      username,
      JSON.stringify([]),
      JSON.stringify(DEFAULT_STATS),
      JSON.stringify(DEFAULT_PET),
      0,
      JSON.stringify([]),
      JSON.stringify({}),
    ],
  );

  return mapProfile(userId, result.rows[0]);
}

export async function updateProfileDictionary(userId: string, dictionary: string[]): Promise<UserProfile> {
  const result = await query(
    `update profiles
        set custom_dictionary_en = $2::jsonb,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(normalizeDictionaryField(dictionary))],
  );

  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }

  return mapProfile(userId, result.rows[0]);
}

export async function updateProfileStats(userId: string, stats: UserStats): Promise<UserProfile> {
  const current = await query<{ stats: unknown }>("select stats from profiles where id = $1", [userId]);
  if (!current.rows[0]) throw new Error("Profile not found");
  const mergedStats = mergeStatsForSave(current.rows[0].stats, stats);
  const result = await query(
    `update profiles
        set stats = $2::jsonb,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(mergedStats)],
  );

  if (!result.rows[0]) throw new Error("Profile not found");
  return mapProfile(userId, result.rows[0]);
}

export async function updateProfilePet(userId: string, pet: PetState): Promise<UserProfile> {
  const current = await query<{ pet: unknown }>("select pet from profiles where id = $1", [userId]);
  if (!current.rows[0]) throw new Error("Profile not found");
  const mergedPet = mergePetForSave(current.rows[0].pet, pet);
  const result = await query(
    `update profiles
        set pet = $2::jsonb,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(normalizePet(mergedPet))],
  );

  if (!result.rows[0]) throw new Error("Profile not found");
  return mapProfile(userId, result.rows[0]);
}

export async function incrementProfileCoins(userId: string, amount: number): Promise<UserProfile> {
  const result = await query(
    `update profiles
        set coins = greatest(0, coins + $2::integer),
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, Math.round(amount || 0)],
  );

  if (!result.rows[0]) throw new Error("Profile not found");
  return mapProfile(userId, result.rows[0]);
}

export async function updateWeeklyReportEmail(userId: string, email: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Введите корректный email для отчёта.");
  }

  const result = await query(
    `update profiles
        set weekly_report_email = $2,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, normalized],
  );

  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }

  return mapProfile(userId, result.rows[0]);
}

export async function syncProfileState(userId: string, profile: Pick<UserProfile, "inventory" | "pet" | "coins">): Promise<UserProfile> {
  const current = await query<{ pet: unknown; coins: number }>("select pet, coins from profiles where id = $1", [userId]);
  if (!current.rows[0]) throw new Error("Profile not found");
  const mergedPet = mergePetForSave(current.rows[0].pet, profile.pet);
  const nextCoins = Math.max(0, Math.max(Math.round(current.rows[0].coins || 0), Math.round(profile.coins || 0)));
  const result = await query(
    `update profiles
        set inventory = $2::jsonb,
            pet = $3::jsonb,
            coins = $4::integer,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [
      userId,
      JSON.stringify(normalizeInventory(profile.inventory)),
      JSON.stringify(normalizePet(mergedPet)),
      nextCoins,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }

  return mapProfile(userId, result.rows[0]);
}

export async function applyGameResult(userId: string, stats: UserStats, pet: PetState, coinsDelta: number): Promise<UserProfile> {
  const current = await query<{ stats: unknown; pet: unknown }>("select stats, pet from profiles where id = $1", [userId]);
  if (!current.rows[0]) throw new Error("Profile not found");
  const mergedStats = mergeStatsForSave(current.rows[0].stats, stats);
  const mergedPet = mergePetForSave(current.rows[0].pet, pet);
  const result = await query(
    `update profiles
        set stats = $2::jsonb,
            pet = $3::jsonb,
            coins = greatest(0, coins + $4::integer),
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(normalizeStats(mergedStats)), JSON.stringify(normalizePet(mergedPet)), Math.round(coinsDelta || 0)],
  );

  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }

  return mapProfile(userId, result.rows[0]);
}