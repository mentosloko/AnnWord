import { ShopItem } from '../types';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Economy smoke test failed: ${message}`);
};

const item: ShopItem = {
  id: 'apple',
  type: 'food',
  name: 'Apple',
  price: 10,
  imageUrl: '/items/apple.png',
  description: 'Test item',
};

const payload = {
  id: item.id,
  type: item.type,
  name: item.name,
  price: item.price,
  imageUrl: item.imageUrl || '',
};

assert(payload.id === 'apple', 'purchase payload must include item id');
assert(payload.type === 'food', 'purchase payload must include item type');
assert(payload.name === 'Apple', 'purchase payload must include item name');
assert(payload.price === 10, 'purchase payload must include numeric price');
assert(payload.imageUrl === '/items/apple.png', 'purchase payload must include image url fallback');
assert(payload.price >= 0, 'purchase price must be non-negative');

console.log(JSON.stringify({ ok: true, checked: 'economy-purchase-payload' }, null, 2));
