import { ShopItem } from '../types';
import { getPuppyAccessoryAssetUrl } from './petAssets';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'apple', name: 'Энерго-яблоко', price: 2, type: 'food', minLevel: 1, description: 'Простое лакомство. Настроение +8, максимум до 80.', imageUrl: '/assets/items/treats/energy_apple.png', effect: { mood: 8, moodCap: 80 } },
  { id: 'cookie', name: 'Хрустик', price: 3, type: 'food', minLevel: 1, description: 'Хрустящее лакомство. Настроение +10, максимум до 85.', imageUrl: '/assets/items/treats/crunchik.png', effect: { mood: 10, moodCap: 85 } },
  { id: 'berry', name: 'Сияющая ягодка', price: 5, type: 'food', minLevel: 2, description: 'Любимая ягодка питомцев. Настроение +15, максимум до 90.', imageUrl: '/assets/items/treats/glowing_berry.png', effect: { mood: 15, moodCap: 90 } },
  { id: 'icecream', name: 'Ледяной десерт', price: 7, type: 'food', minLevel: 3, description: 'Праздничное лакомство. Настроение +20, максимум до 95.', imageUrl: '/assets/items/treats/ice_dessert.png', effect: { mood: 20, moodCap: 95 } },
  { id: 'star_treat', name: 'Звёздный кристалл', price: 10, type: 'food', minLevel: 5, description: 'Редкое лакомство. Настроение +25, максимум до 100.', imageUrl: '/assets/items/treats/star_crystal.png', effect: { mood: 25, moodCap: 100 } },

  { id: 'bow', name: 'Бантик', price: 5, type: 'accessory', minLevel: 1, description: 'Милый аксессуар для персонажа.', imageUrl: getPuppyAccessoryAssetUrl('bow') || undefined },
  { id: 'glasses', name: 'Очки', price: 6, type: 'accessory', minLevel: 1, description: 'Стильные очки для умного образа.', imageUrl: getPuppyAccessoryAssetUrl('glasses') || undefined },
  { id: 'hat', name: 'Шапочка', price: 7, type: 'accessory', minLevel: 2, description: 'Уютная шапочка для прогулок.', imageUrl: getPuppyAccessoryAssetUrl('hat') || undefined },
  { id: 'hero_cape', name: 'Плащ героя', price: 10, type: 'accessory', minLevel: 3, description: 'Для персонажа, который готов к приключениям.', imageUrl: getPuppyAccessoryAssetUrl('hero_cape') || undefined },
  { id: 'star_collar', name: 'Звёздный ошейник', price: 12, type: 'accessory', minLevel: 4, description: 'Сияющий аксессуар для любимого персонажа.', imageUrl: getPuppyAccessoryAssetUrl('star_collar') || undefined },
  { id: 'crown', name: 'Корона', price: 15, type: 'accessory', minLevel: 5, description: 'Королевский аксессуар для высокого уровня.', imageUrl: 'https://picsum.photos/seed/crown/100/100' },

  { id: 'dog_house', name: 'Будка', price: 20, type: 'home', minLevel: 3, description: 'Домик для щенка.', imageUrl: 'https://picsum.photos/seed/dog-house/100/100', characterType: 'Puppy' },
  { id: 'dragon_nest', name: 'Гнездо', price: 20, type: 'home', minLevel: 3, description: 'Уютное гнездо для дракончика.', imageUrl: 'https://picsum.photos/seed/dragon-nest/100/100', characterType: 'Dragon' },
  { id: 'charging_station', name: 'Зарядная станция', price: 20, type: 'home', minLevel: 3, description: 'Станция отдыха для робокота.', imageUrl: 'https://picsum.photos/seed/charging-station/100/100', characterType: 'RoboCat' },

  {
    id: 'mystery_box',
    name: 'Секретная коробка',
    price: 8,
    type: 'mystery',
    minLevel: 2,
    description: 'Случайный предмет: чаще выпадают простые лакомства, реже — дорогие аксессуары.',
    imageUrl: 'https://picsum.photos/seed/mystery-box/100/100',
    randomReward: {
      pool: [
        { itemId: 'apple', weight: 28 },
        { itemId: 'cookie', weight: 24 },
        { itemId: 'berry', weight: 18 },
        { itemId: 'icecream', weight: 10 },
        { itemId: 'bow', weight: 8 },
        { itemId: 'glasses', weight: 6 },
        { itemId: 'hat', weight: 4 },
        { itemId: 'crown', weight: 2 },
      ],
    },
  },
];

export const getShopItemById = (itemId: string): ShopItem | undefined =>
  SHOP_ITEMS.find(item => item.id === itemId);

export const getShopItemsByType = (type: ShopItem['type']): ShopItem[] =>
  SHOP_ITEMS.filter(item => item.type === type);