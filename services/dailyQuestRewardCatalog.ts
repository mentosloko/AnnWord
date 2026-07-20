import type { ShopItem } from '../types';

const DAILY_TREATS: Array<{ item: ShopItem; weight: number }> = [
  { item: { id: 'apple', name: 'Энерго-яблоко', price: 4, type: 'food', minLevel: 1, description: 'Простое лакомство. Настроение +8.', effect: { mood: 8 } }, weight: 40 },
  { item: { id: 'cookie', name: 'Хрустик', price: 7, type: 'food', minLevel: 1, description: 'Вкусное лакомство. Настроение +12.', effect: { mood: 12 } }, weight: 30 },
  { item: { id: 'berry', name: 'Сияющая ягодка', price: 11, type: 'food', minLevel: 2, description: 'Особое лакомство. Настроение +16.', effect: { mood: 16 } }, weight: 20 },
  { item: { id: 'icecream', name: 'Ледяной десерт', price: 17, type: 'food', minLevel: 3, description: 'Праздничное лакомство. Настроение +22.', effect: { mood: 22 } }, weight: 8 },
  { item: { id: 'star_treat', name: 'Звёздный кристалл', price: 25, type: 'food', minLevel: 5, description: 'Редкое лакомство. Настроение +30.', effect: { mood: 30 } }, weight: 2 },
];

const stableIndex = (input: string, modulo: number): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
};

export const pickDailyQuestTreat = (userId: string, questDate: string): ShopItem => {
  const totalWeight = DAILY_TREATS.reduce((sum, entry) => sum + entry.weight, 0);
  let point = stableIndex(`${userId}:${questDate}:daily-treat-v1`, totalWeight);
  for (const entry of DAILY_TREATS) {
    if (point < entry.weight) return entry.item;
    point -= entry.weight;
  }
  return DAILY_TREATS[0].item;
};
