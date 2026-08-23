import type { PoolClient } from 'pg';
import type { InventoryItem, PetState, UserProfile, UserStats } from '../types';
import { normalizeInventory, normalizePet, mapProfileFromDB } from '../services/profileMapper';
import { applyServerMoodIncrease, applyServerPetMoodClock, markServerPetActivity } from '../services/serverPetMoodPolicy';
import { transaction } from './db';
import { mergePetForSave, mergeStatsForSave, PROFILE_COLUMNS } from './profileRepository';
import { getServerShopItem } from './shopCatalog';
import { mergeAssignedWordsIntoProfile } from './profileHydration';
import { insertAnalyticsEvents, insertGameEvents } from './activityEventRepository';
import { addServerTiming } from './performanceTelemetry';

const MAX_EQUIPPED_ACCESSORIES = 2;
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
const sameStringSet = (first: string[] | undefined, second: string[] | undefined): boolean => {
  const left = Array.from(new Set(first || [])).sort();
  const right = Array.from(new Set(second || [])).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
};

interface LockedProfileRow {
  id: string;
  stats: unknown;
  pet: unknown;
  inventory: unknown;
  assigned_words: unknown;
  server_now: Date | string;
  [key: string]: unknown;
}

const lockProfile = async (client: PoolClient, userId: string): Promise<LockedProfileRow> => {
  const result = await client.query<LockedProfileRow>(
    `select p.*,
            coalesce(latest_set.words, '{}'::text[]) as assigned_words,
            now() as server_now
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
      for update of p`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Профиль не найден.');
  return row;
};

const serverNowMs = (row: LockedProfileRow): number => {
  const parsed = row.server_now instanceof Date ? row.server_now.getTime() : Date.parse(String(row.server_now));
  if (!Number.isFinite(parsed)) throw new Error('Сервер не вернул корректное время.');
  return parsed;
};

const mapProfileWithAssignments = (row: unknown, assignedWords: unknown): UserProfile => {
  const startedAt = performance.now();
  try {
    return mergeAssignedWordsIntoProfile(mapProfileFromDB(row), assignedWords);
  } finally {
    addServerTiming('hydrate', performance.now() - startedAt);
  }
};

const persistPet = async (client: PoolClient, userId: string, pet: PetState, assignedWords: unknown): Promise<UserProfile> => {
  const updated = await client.query(
    `update profiles set pet = $2::jsonb, updated_at = now() where id = $1 returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(pet)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return mapProfileWithAssignments(updated.rows[0], assignedWords);
};

const persistPetAndInventory = async (
  client: PoolClient,
  userId: string,
  pet: PetState,
  inventory: InventoryItem[],
  assignedWords: unknown,
): Promise<UserProfile> => {
  const updated = await client.query(
    `update profiles
        set pet = $2::jsonb,
            inventory = $3::jsonb,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(pet), JSON.stringify(inventory)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return mapProfileWithAssignments(updated.rows[0], assignedWords);
};

const withServerMood = (row: LockedProfileRow) => {
  const nowMs = serverNowMs(row);
  const currentPet = normalizePet(row.pet);
  const clock = applyServerPetMoodClock(currentPet, nowMs);
  return { nowMs, currentPet, clock };
};

const reconcilePet = (petRaw: unknown, nowMs: number, markActivity: boolean): PetState => {
  const clock = applyServerPetMoodClock(normalizePet(petRaw), nowMs);
  if (!markActivity) return clock.pet;
  const today = moscowDateKey(new Date(nowMs));
  return markServerPetActivity(clock.pet, today, previousMoscowDateKey(nowMs));
};

export const reconcileProfileMood = async (userId: string, markActivity = false): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const { nowMs, clock } = withServerMood(row);
  const today = moscowDateKey(new Date(nowMs));
  const nextPet = markActivity
    ? markServerPetActivity(clock.pet, today, previousMoscowDateKey(nowMs))
    : clock.pet;
  const changed = clock.changed
    || nextPet.lastDailyActivityDate !== clock.pet.lastDailyActivityDate
    || nextPet.dailyStreak !== clock.pet.dailyStreak
    || !sameStringSet(nextPet.earnedStickerIds, clock.pet.earnedStickerIds);
  return changed
    ? persistPet(client, userId, nextPet, row.assigned_words)
    : mapProfileWithAssignments(row, row.assigned_words);
});

export const updateStatsAndReconcileProfile = async (userId: string, stats: UserStats): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const mergedStats = mergeStatsForSave(row.stats, stats);
  const nextPet = reconcilePet(row.pet, serverNowMs(row), false);
  const updated = await client.query(
    `update profiles
        set stats = $2::jsonb,
            pet = $3::jsonb,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(mergedStats), JSON.stringify(nextPet)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return mapProfileWithAssignments(updated.rows[0], row.assigned_words);
});

export const incrementCoinsAndReconcileProfile = async (userId: string, amount: number): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const nextPet = reconcilePet(row.pet, serverNowMs(row), false);
  const updated = await client.query(
    `update profiles
        set coins = greatest(0, coins + $2::integer),
            pet = $3::jsonb,
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, Math.round(amount || 0), JSON.stringify(nextPet)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');
  return mapProfileWithAssignments(updated.rows[0], row.assigned_words);
});

export const applyGameResultAndReconcileProfile = async (
  userId: string,
  stats: UserStats,
  pet: PetState,
  coinsDelta: number,
  analyticsEvents: unknown = [],
  gameEvents: unknown = [],
): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const mergedStats = mergeStatsForSave(row.stats, stats);
  const mergedPet = mergePetForSave(row.pet, pet);
  const nextPet = reconcilePet(mergedPet, serverNowMs(row), true);
  const updated = await client.query(
    `update profiles
        set stats = $2::jsonb,
            pet = $3::jsonb,
            coins = greatest(0, coins + $4::integer),
            updated_at = now()
      where id = $1
      returning ${PROFILE_COLUMNS}`,
    [userId, JSON.stringify(mergedStats), JSON.stringify(nextPet), Math.round(coinsDelta || 0)],
  );
  if (!updated.rows[0]) throw new Error('Профиль не найден.');

  await insertAnalyticsEvents(userId, analyticsEvents, 100, client);
  await insertGameEvents(userId, gameEvents, 100, client);
  return mapProfileWithAssignments(updated.rows[0], row.assigned_words);
});

const inventoryQuantity = (inventory: InventoryItem[], itemId: string): number => inventory.find(item => item.id === itemId)?.quantity || 0;

const consumedFoodId = (current: InventoryItem[], incoming: InventoryItem[]): string | null => {
  const consumed = current.filter(item => item.type === 'food' && inventoryQuantity(incoming, item.id) === Math.max(0, item.quantity - 1));
  const otherQuantityChanged = current.some(item => {
    if (consumed.some(entry => entry.id === item.id)) return false;
    return inventoryQuantity(incoming, item.id) !== item.quantity;
  });
  return consumed.length === 1 && !otherQuantityChanged ? consumed[0].id : null;
};

const decrementInventory = (inventory: InventoryItem[], itemId: string): InventoryItem[] => inventory
  .map(item => item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item)
  .filter(item => item.quantity > 0);

const mergeNonMoodPetFields = (serverPet: PetState, incoming: unknown): PetState => {
  const incomingPet = normalizePet(incoming);
  const merged = normalizePet({ ...serverPet, ...incomingPet });
  return {
    ...merged,
    moodScore: serverPet.moodScore,
    mood: serverPet.mood,
    hunger: serverPet.hunger,
    energy: serverPet.energy,
    moodUpdatedAt: serverPet.moodUpdatedAt,
    lastDailyActivityDate: serverPet.lastDailyActivityDate,
    dailyStreak: serverPet.dailyStreak,
    earnedStickerIds: Array.from(new Set([...(serverPet.earnedStickerIds || []), ...(incomingPet.earnedStickerIds || [])])),
  };
};

/**
 * Compatibility path for cached clients that still send the whole profile when
 * an inventory item is used. Mood can increase only when the server observes
 * exactly one owned food item being consumed.
 */
export const syncProfileStateServerAuthoritative = async (
  userId: string,
  incomingPet: unknown,
  incomingInventory: unknown,
): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const { nowMs, clock } = withServerMood(row);
  const currentInventory = normalizeInventory(row.inventory);
  const requestedInventory = normalizeInventory(incomingInventory);
  const foodId = consumedFoodId(currentInventory, requestedInventory);
  let pet = mergeNonMoodPetFields(clock.pet, incomingPet);
  let inventory = currentInventory;

  if (foodId) {
    const food = getServerShopItem(foodId);
    if (!food || food.type !== 'food') throw new Error('Лакомство не найдено.');
    if ((clock.pet.moodScore || 0) >= 100) throw new Error('Персонаж уже в восторге! Лакомство пригодится позже.');
    pet = applyServerMoodIncrease(pet, food.moodEffect || 8, nowMs);
    pet.requestedTreatId = pet.requestedTreatId === foodId ? undefined : pet.requestedTreatId;
    inventory = decrementInventory(currentInventory, foodId);
  }

  return persistPetAndInventory(client, userId, pet, inventory, row.assigned_words);
});

export const useProfileItemServerAuthoritative = async (userId: string, itemId: string): Promise<UserProfile> => transaction(async client => {
  const row = await lockProfile(client, userId);
  const { nowMs, clock } = withServerMood(row);
  const inventory = normalizeInventory(row.inventory);
  const owned = inventory.find(item => item.id === itemId && item.quantity > 0);
  if (!owned) throw new Error('Предмет не найден.');
  const shopItem = getServerShopItem(itemId);
  let pet = { ...clock.pet, equippedAccessories: [...(clock.pet.equippedAccessories || [])] };
  let nextInventory = inventory;

  if (owned.type === 'food') {
    if (!shopItem || shopItem.type !== 'food') throw new Error('Лакомство не найдено.');
    if ((pet.moodScore || 0) >= 100) throw new Error('Персонаж уже в восторге! Лакомство пригодится позже.');
    pet = applyServerMoodIncrease(pet, shopItem.moodEffect || 8, nowMs);
    pet.requestedTreatId = pet.requestedTreatId === itemId ? undefined : pet.requestedTreatId;
    nextInventory = decrementInventory(inventory, itemId);
  } else if (owned.type === 'accessory') {
    const equipped = pet.equippedAccessories || [];
    pet.equippedAccessories = equipped.includes(itemId)
      ? equipped.filter(id => id !== itemId)
      : equipped.length >= MAX_EQUIPPED_ACCESSORIES
        ? (() => { throw new Error('Можно надеть максимум 2 аксессуара.'); })()
        : [...equipped, itemId];
  } else if (owned.type === 'home') {
    if (shopItem?.characterType && shopItem.characterType !== pet.type) throw new Error('Этот домик не подходит выбранному персонажу.');
    pet.activeHomeItemId = pet.activeHomeItemId === itemId ? undefined : itemId;
  } else if (owned.type === 'pet') {
    pet.type = owned.name;
    pet.name = owned.name;
    pet = applyServerMoodIncrease({ ...pet, moodScore: 0 }, 80, nowMs);
  }

  return persistPetAndInventory(client, userId, pet, nextInventory, row.assigned_words);
});
