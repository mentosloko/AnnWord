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
};

const cleanWords = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((word): word is string => typeof word === "string").map((word) => word.trim().toUpperCase()).filter(Boolean)))
  : [];

async function addAssignedWords(userId: string, profile: UserProfile): Promise<UserProfile> {
  const result = await query<{ words: string[] }>(
    `select coalesce(array_agg(distinct word) filter (where word is not null), '{}') as words
       from assigned_word_sets s
       left join lateral unnest(s.words) word on true
      where s.learner_user_id = $1
        and s.archived_at is null`,
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

  return mapProfile(userId, result.rows[0]);
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
  const result = await query(
    `update profiles
        set inventory = $2::jsonb,
            pet = $3::jsonb,
            coins = greatest(0, $4::integer),
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [
      userId,
      JSON.stringify(normalizeInventory(profile.inventory)),
      JSON.stringify(normalizePet(profile.pet)),
      Math.max(0, Math.round(profile.coins || 0)),
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }

  return mapProfile(userId, result.rows[0]);
}

export async function applyGameResult(userId: string, stats: UserStats, pet: PetState, coinsDelta: number): Promise<UserProfile> {
  const result = await query(
    `update profiles
        set stats = $2::jsonb,
            pet = $3::jsonb,
            coins = greatest(0, coins + $4::integer),
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(normalizeStats(stats)), JSON.stringify(normalizePet(pet)), Math.round(coinsDelta || 0)],
  );

  if (!result.rows[0]) {
    throw new Error("Profile not found");
  }

  return mapProfile(userId, result.rows[0]);
}
