import type { InventoryItemType } from "../types";

export type ServerShopItem = {
  id: string;
  name: string;
  price: number;
  type: InventoryItemType;
  minLevel: number;
};

const items: ServerShopItem[] = [
  { id: "apple", name: "Энерго-яблоко", price: 4, type: "food", minLevel: 1 },
  { id: "cookie", name: "Хрустик", price: 7, type: "food", minLevel: 1 },
  { id: "berry", name: "Сияющая ягодка", price: 11, type: "food", minLevel: 2 },
  { id: "icecream", name: "Ледяной десерт", price: 17, type: "food", minLevel: 3 },
  { id: "star_treat", name: "Звёздный кристалл", price: 25, type: "food", minLevel: 5 },
  { id: "magic_bone", name: "Косточка", price: 32, type: "food", minLevel: 2 },
  { id: "magic_orange", name: "Апельсин", price: 38, type: "food", minLevel: 3 },
  { id: "magic_apple_juice", name: "Яблочный сок", price: 44, type: "food", minLevel: 3 },
  { id: "magic_milkshake", name: "Молочный коктейль", price: 52, type: "food", minLevel: 4 },
  { id: "energy_candy", name: "Энерго-конфета", price: 60, type: "food", minLevel: 5 },
  { id: "bow", name: "Бантик", price: 25, type: "accessory", minLevel: 1 },
  { id: "glasses", name: "Очки", price: 40, type: "accessory", minLevel: 1 },
  { id: "hat", name: "Шапочка", price: 60, type: "accessory", minLevel: 2 },
  { id: "hero_cape", name: "Плащ героя", price: 90, type: "accessory", minLevel: 3 },
  { id: "star_collar", name: "Звёздный талисман", price: 125, type: "accessory", minLevel: 4 },
  { id: "crown", name: "Корона", price: 170, type: "accessory", minLevel: 5 },
  { id: "dog_house", name: "Будка", price: 120, type: "home", minLevel: 3 },
  { id: "dragon_nest", name: "Гнездо", price: 120, type: "home", minLevel: 3 },
  { id: "charging_station", name: "Зарядная станция", price: 120, type: "home", minLevel: 3 },
];

const byId = new Map(items.map(item => [item.id, item]));

export const getServerShopItem = (itemId: string): ServerShopItem | null => byId.get(itemId) || null;
