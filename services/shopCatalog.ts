import { ShopItem } from '../types';
import { getPuppyAccessoryAssetUrl } from './petAssets';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'apple', name: 'Энерго-яблоко', price: 4, type: 'food', minLevel: 1, description: 'Простое лакомство. Настроение +8.', imageUrl: '/assets/items/treats/energy_apple.png', effect: { mood: 8 } },
  { id: 'cookie', name: 'Хрустик', price: 7, type: 'food', minLevel: 1, description: 'Вкусное лакомство. Настроение +12.', imageUrl: '/assets/items/treats/crunchik.png', effect: { mood: 12 } },
  { id: 'berry', name: 'Сияющая ягодка', price: 11, type: 'food', minLevel: 2, description: 'Особое лакомство. Настроение +16.', imageUrl: '/assets/items/treats/glowing_berry.png', effect: { mood: 16 } },
  { id: 'icecream', name: 'Ледяной десерт', price: 17, type: 'food', minLevel: 3, description: 'Праздничное лакомство. Настроение +22.', imageUrl: '/assets/items/treats/ice_dessert.png', effect: { mood: 22 } },
  { id: 'star_treat', name: 'Звёздный кристалл', price: 25, type: 'food', minLevel: 5, description: 'Редкое лакомство. Настроение +30.', imageUrl: '/assets/items/treats/star_crystal.png', effect: { mood: 30 } },

  { id: 'bow', name: 'Бантик', price: 25, type: 'accessory', minLevel: 1, description: 'Милый аксессуар для персонажа.', imageUrl: getPuppyAccessoryAssetUrl('bow') || undefined },
  { id: 'glasses', name: 'Очки', price: 40, type: 'accessory', minLevel: 1, description: 'Стильные очки для умного образа.', imageUrl: getPuppyAccessoryAssetUrl('glasses') || undefined },
  { id: 'hat', name: 'Шапочка', price: 60, type: 'accessory', minLevel: 2, description: 'Уютная шапочка для прогулок.', imageUrl: getPuppyAccessoryAssetUrl('hat') || undefined },
  { id: 'hero_cape', name: 'Плащ героя', price: 90, type: 'accessory', minLevel: 3, description: 'Для персонажа, который готов к приключениям.', imageUrl: getPuppyAccessoryAssetUrl('hero_cape') || undefined },
  { id: 'star_collar', name: 'Звёздный талисман', price: 125, type: 'accessory', minLevel: 4, description: 'Сияющий талисман для любимого персонажа.', imageUrl: getPuppyAccessoryAssetUrl('star_collar') || undefined },
  { id: 'crown', name: 'Корона', price: 170, type: 'accessory', minLevel: 5, description: 'Королевский аксессуар для высокого уровня.', imageUrl: 'https://picsum.photos/seed/crown/100/100' },

  { id: 'dog_house', name: 'Будка', price: 120, type: 'home', minLevel: 3, description: 'Домик для щенка.', imageUrl: 'https://picsum.photos/seed/dog-house/100/100', characterType: 'Puppy' },
  { id: 'dragon_nest', name: 'Гнездо', price: 120, type: 'home', minLevel: 3, description: 'Уютное гнездо для дракончика.', imageUrl: 'https://picsum.photos/seed/dragon-nest/100/100', characterType: 'Dragon' },
  { id: 'charging_station', name: 'Зарядная станция', price: 120, type: 'home', minLevel: 3, description: 'Станция отдыха для робокота.', imageUrl: 'https://picsum.photos/seed/charging-station/100/100', characterType: 'RoboCat' },

  {
    id: 'mystery_box',
    name: 'Секретная коробка',
    price: 10,
    type: 'mystery',
    minLevel: 2,
    description: 'Случайное лакомство-сюрприз для питомца.',
    imageUrl: '',
    randomReward: {
      pool: [
        { itemId: 'apple', weight: 40 },
        { itemId: 'cookie', weight: 30 },
        { itemId: 'berry', weight: 20 },
        { itemId: 'icecream', weight: 8 },
        { itemId: 'star_treat', weight: 2 },
      ],
    },
  },
];

export const getShopItemById = (itemId: string): ShopItem | undefined =>
  SHOP_ITEMS.find(item => item.id === itemId);

export const getShopItemsByType = (type: ShopItem['type']): ShopItem[] =>
  SHOP_ITEMS.filter(item => item.type === type);
