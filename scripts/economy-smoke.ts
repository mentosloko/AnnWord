import { ShopItem, UserProfile } from '../types';
import { applyItemUseLocally, applyPurchaseLocally, canPurchaseItem, getInventoryQuantity } from '../services/economyEngine';
import { getShopItemById, getShopItemsByType, SHOP_ITEMS } from '../services/shopCatalog';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Economy smoke test failed: ${message}`);
};

const baseProfile: UserProfile = {
  username: 'Tester',
  role: 'user',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Щенок', type: 'Puppy', level: 5, mood: 'happy', xp: 70, moodScore: 60, stage: 'stage_2', hunger: 60, energy: 60, equippedAccessories: [] },
  coins: 30,
  inventory: [],
};

const apple = getShopItemById('apple') as ShopItem;
assert(Boolean(apple), 'shop catalog must include apple');
assert(SHOP_ITEMS.length >= 10, 'shop catalog must include multiple item categories');
assert(getShopItemsByType('food').every(item => item.type === 'food'), 'food tab must only include treat items');
assert(getShopItemsByType('home').every(item => item.type === 'home'), 'home tab must only include home items');

const payload = { id: apple.id, type: apple.type, name: apple.name, price: apple.price, imageUrl: apple.imageUrl || '' };
assert(payload.id === 'apple', 'purchase payload must include item id');
assert(payload.type === 'food', 'purchase payload must include item type');
assert(payload.price === 2, 'apple must use child-friendly small price');
assert(payload.price >= 0, 'purchase price must be non-negative');

const purchaseCheck = canPurchaseItem(baseProfile, apple);
assert(purchaseCheck.ok, 'profile with enough coins and level must be able to buy apple');

const purchaseOne = applyPurchaseLocally(baseProfile, apple);
assert(purchaseOne.ok && purchaseOne.profile, 'local purchase must succeed');
assert(purchaseOne.profile!.coins === 28, 'purchase must subtract item price once');
assert(getInventoryQuantity(purchaseOne.profile!.inventory, 'apple') === 1, 'purchase must add one apple');

const purchaseTwo = applyPurchaseLocally(purchaseOne.profile!, apple);
assert(purchaseTwo.ok && purchaseTwo.profile, 'second local food purchase must succeed');
assert(purchaseTwo.profile!.coins === 26, 'second purchase must subtract price once');
assert(getInventoryQuantity(purchaseTwo.profile!.inventory, 'apple') === 2, 'food purchases must stack quantity');

const usedApple = applyItemUseLocally(purchaseTwo.profile!, 'apple');
assert(usedApple.ok && usedApple.profile, 'using treat must succeed');
assert(usedApple.profile!.pet.moodScore === 68, 'using apple must increase moodScore by 8');
assert(getInventoryQuantity(usedApple.profile!.inventory, 'apple') === 1, 'using treat must decrement quantity');

const poorProfile = { ...baseProfile, coins: 0 };
assert(canPurchaseItem(poorProfile, apple).reason === 'insufficient_funds', 'insufficient funds must be explicit');

const lockedItem = getShopItemById('crown') as ShopItem;
const lockedProfile = { ...baseProfile, pet: { ...baseProfile.pet, level: 1 }, coins: 9999 };
assert(canPurchaseItem(lockedProfile, lockedItem).reason === 'locked', 'level lock must be explicit');

const otherCharacterHome = getShopItemById('dragon_nest') as ShopItem;
assert(canPurchaseItem(baseProfile, otherCharacterHome).reason === 'locked', 'character-specific home must be locked for another character');

console.log(JSON.stringify({ ok: true, checked: 'economy-engine-and-shop-catalog' }, null, 2));
