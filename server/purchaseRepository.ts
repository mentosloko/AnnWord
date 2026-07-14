import { transaction } from "./db";
import { PROFILE_COLUMNS, getProfileById } from "./profileRepository";
import { normalizeInventory, normalizePet } from "../services/profileMapper";
import type { InventoryItem, PetState } from "../types";
import { getServerShopItem } from "./shopCatalog";

const addInventoryItem = (inventory: InventoryItem[], item: { id: string; name: string; type: InventoryItem["type"] }): InventoryItem[] => {
  const existing = inventory.find(entry => entry.id === item.id);
  if (existing) {
    return inventory.map(entry => entry.id === item.id
      ? { ...entry, quantity: item.type === "food" ? Math.max(0, entry.quantity || 0) + 1 : 1 }
      : entry);
  }
  return [...inventory, { id: item.id, name: item.name, type: item.type, quantity: 1 }];
};

export async function purchaseProfileItem(userId: string, itemId: string) {
  const item = getServerShopItem(itemId);
  if (!item) throw new Error("Товар не найден.");

  await transaction(async client => {
    const current = await client.query<{ coins: number; inventory: unknown; pet: unknown }>(
      "select coins, inventory, pet from profiles where id = $1 for update",
      [userId],
    );
    const row = current.rows[0];
    if (!row) throw new Error("Профиль не найден.");

    const pet = normalizePet(row.pet) as PetState;
    if ((pet.level || 1) < item.minLevel) throw new Error(`Товар откроется на уровне ${item.minLevel}.`);
    if (Math.max(0, Math.round(row.coins || 0)) < item.price) throw new Error("Недостаточно монет для покупки.");

    const inventory = addInventoryItem(normalizeInventory(row.inventory), item);
    const updated = await client.query(
      `update profiles
          set coins = coins - $2::integer,
              inventory = $3::jsonb,
              updated_at = now()
        where id = $1
          and coins >= $2::integer
        returning ${PROFILE_COLUMNS}`,
      [userId, item.price, JSON.stringify(inventory)],
    );
    if (!updated.rows[0]) throw new Error("Недостаточно монет для покупки.");
  });

  const profile = await getProfileById(userId);
  if (!profile) throw new Error("Профиль не найден.");
  return profile;
}
