import { ShopItem } from '../types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'apple', name: 'Яблоко', price: 2, type: 'food', minLevel: 1, description: 'Простое лакомство. Настроение +8, максимум до 80.', imageUrl: 'https://picsum.photos/seed/apple/100/100', effect: { mood: 8, moodCap: 80 } },
  { id: 'cookie', name: 'Печенье', price: 3, type: 'food', minLevel: 1, description: 'Сладкое лакомство. Настроение +10, максимум до 85.', imageUrl: 'https://picsum.photos/seed/cookie/100/100', effect: { mood: 10, moodCap: 85 } },
  { id: 'berry', name: 'Ягодка', price: 5, type: 'food', minLevel: 2, description: 'Любимая ягодка. Настроение +15, максимум до 90.', imageUrl: 'https://picsum.photos/seed/berry/100/100', effect: { mood: 15, moodCap: 90 } },
  { id: 'icecream', name: 'Мороженое', price: 7, type: 'food', minLevel: 3, description: 'Праздничное лакомство. Настроение +20, максимум до 95.', imageUrl: 'https://picsum.photos/seed/icecream/100/100', effect: { mood: 20, moodCap: 95 } },
  { id: 'star_treat', name: 'Звёздное лакомство', price: 10, type: 'food', minLevel: 5, description: 'Особое лакомство. Настроение +25, максимум до 100.', imageUrl: 'https://picsum.photos/seed/star-treat/100/100', effect: { mood: 25, moodCap: 100 } },

  { id: 'bow', name: 'Бантик', price: 5, type: 'accessory', minLevel: 1, description: 'Милый аксессуар для персонажа.', imageUrl: 'https://picsum.photos/seed/bow/100/100' },
  { id: 'glasses', name: 'Очки', price: 6, type: 'accessory', minLevel: 1, description: 'Стильные очки для умного образа.', imageUrl: 'https://picsum.photos/seed/glasses/100/100' },
  { id: 'hat', name: 'Шапочка', price: 7, type: 'accessory', minLevel: 2, description: 'Уютная шапочка для прогулок.', imageUrl: 'https://picsum.photos/seed/hat/100/100' },
  { id: 'hero_cape', name: 'Плащ героя', price: 10, type: 'accessory', minLevel: 3, description: 'Для персонажа, который готов к приключениям.', imageUrl: 'https://picsum.photos/seed/hero-cape/100/100' },
  { id: 'star_collar', name: 'Звёздный ошейник', price: 12, type: 'accessory', minLevel: 4, description: 'Сияющий аксессуар для любимого персонажа.', imageUrl: 'https://picsum.photos/seed/star-collar/100/100' },
  { id: 'crown', name: 'Корона', price: 15, type: 'accessory', minLevel: 5, description: 'Королевский аксессуар для высокого уровня.', imageUrl: 'https://picsum.photos/seed/crown/100/100' },

  { id: 'dog_house', name: 'Будка', price: 20, type: 'home', minLevel: 3, description: 'Домик для щенка.', imageUrl: 'https://picsum.photos/seed/dog-house/100/100', characterType: 'Puppy' },
  { id: 'dragon_nest', name: 'Гнездо', price: 20, type: 'home', minLevel: 3, description: 'Уютное гнездо для дракончика.', imageUrl: 'https://picsum.photos/seed/dragon-nest/100/100', characterType: 'Dragon' },
  { id: 'charging_station', name: 'Зарядная станция', price: 20, type: 'home', minLevel: 3, description: 'Станция отдыха для робокота.', imageUrl: 'https://picsum.photos/seed/charging-station/100/100', characterType: 'RoboCat' },
];

export const getShopItemById = (itemId: string): ShopItem | undefined =>
  SHOP_ITEMS.find(item => item.id === itemId);

export const getShopItemsByType = (type: ShopItem['type']): ShopItem[] =>
  SHOP_ITEMS.filter(item => item.type === type);
