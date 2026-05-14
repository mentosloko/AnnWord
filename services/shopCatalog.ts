import { ShopItem } from '../types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'apple', name: 'Яблоко', price: 10, type: 'food', minLevel: 1, description: 'Свежее яблоко для питомца. Восстанавливает немного сытости.', imageUrl: 'https://picsum.photos/seed/apple/100/100' },
  { id: 'cake', name: 'Торт', price: 50, type: 'food', minLevel: 3, description: 'Сладкое угощение. Восстанавливает больше сытости и настроение.', imageUrl: 'https://picsum.photos/seed/cake/100/100' },
  { id: 'steak', name: 'Стейк', price: 100, type: 'food', minLevel: 5, description: 'Сытная еда для высокого уровня питомца.', imageUrl: 'https://picsum.photos/seed/steak/100/100' },
  { id: 'cat', name: 'Кот', price: 500, type: 'pet', minLevel: 5, description: 'Новый питомец-компаньон для словарного путешествия.', imageUrl: 'https://picsum.photos/seed/cat/100/100' },
  { id: 'dragon', name: 'Дракон', price: 2000, type: 'pet', minLevel: 10, description: 'Редкий питомец для продвинутого игрока.', imageUrl: 'https://picsum.photos/seed/dragon/100/100' },
  { id: 'hat', name: 'Шляпа', price: 150, type: 'accessory', minLevel: 2, description: 'Косметический аксессуар для питомца.', imageUrl: 'https://picsum.photos/seed/hat/100/100' },
  { id: 'glasses', name: 'Очки', price: 300, type: 'accessory', minLevel: 4, description: 'Стильный аксессуар для питомца.', imageUrl: 'https://picsum.photos/seed/glasses/100/100' },
];

export const getShopItemById = (itemId: string): ShopItem | undefined =>
  SHOP_ITEMS.find(item => item.id === itemId);

export const getShopItemsByType = (type: ShopItem['type']): ShopItem[] =>
  SHOP_ITEMS.filter(item => item.type === type);
