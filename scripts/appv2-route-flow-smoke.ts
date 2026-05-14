import { readFileSync } from 'node:fs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`AppV2 route flow smoke failed: ${message}`);
};

const read = (path: string) => readFileSync(path, 'utf8');

const appSource = read('AppV2.tsx');
const shopSource = read('components/Shop.tsx');
const petRoomSource = read('components/PetRoom.tsx');
const petWidgetSource = read('components/PetWidget.tsx');

const requiredRouteFragments = [
  "landing:",
  "setup:",
  "game:",
  "profile:",
  "anagrams:",
  "sprint:",
  "memory:",
  "hangman:",
  "shop:",
  "pet_room:",
];

for (const fragment of requiredRouteFragments) {
  assert(appSource.includes(fragment), `AppV2 screens map must include ${fragment}`);
}

const requiredNavigationFragments = [
  "onStartClassic={() => setRoute('setup')}",
  "onStartAnagrams={() => setRoute('anagrams')}",
  "onStartSprint={() => setRoute('sprint')}",
  "onStartHangman={() => setRoute('hangman')}",
  "onStartMemory={() => setRoute('memory')}",
  "onOpenShop={() => setRoute('shop')}",
  "onOpenProfile={() => setRoute('profile')}",
  "onNavigateToPetRoom={() => setRoute('pet_room')}",
  "shop: <Shop userProfile={userProfile} onBuy={handleBuy} onClose={goHome} />",
  "pet_room: <PetRoom userProfile={userProfile} onUseItem={handleUseItem} onClose={goHome} />",
];

for (const fragment of requiredNavigationFragments) {
  assert(appSource.includes(fragment), `AppV2 must keep route wiring: ${fragment}`);
}

const forbiddenAppFragments = [
  "./App'",
  './App"',
  'LegacyAppBridge',
  'AppProviders',
  'NavigationProvider',
  'ProfileProvider',
  'AuthProvider',
  'navigationBridge',
  'forceHomeNavigation',
  'navigateToRoute',
];

for (const fragment of forbiddenAppFragments) {
  assert(!appSource.includes(fragment), `AppV2 must not depend on legacy fragment: ${fragment}`);
}

for (const [path, source] of [
  ['components/Shop.tsx', shopSource],
  ['components/PetRoom.tsx', petRoomSource],
  ['components/PetWidget.tsx', petWidgetSource],
] as const) {
  assert(!source.includes('navigationBridge'), `${path} must not import legacy navigationBridge`);
  assert(!source.includes('forceHomeNavigation'), `${path} must not call forceHomeNavigation`);
  assert(!source.includes('navigateToRoute'), `${path} must not call navigateToRoute`);
}

assert(shopSource.includes('onClose: () => void'), 'Shop must keep explicit onClose callback contract');
assert(shopSource.includes('onClick={onClose}'), 'Shop back buttons must close through parent callback');
assert(petRoomSource.includes('onClose: () => void'), 'PetRoom must keep explicit onClose callback contract');
assert(petRoomSource.includes('onClick={onClose}'), 'PetRoom back button must close through parent callback');
assert(petWidgetSource.includes('onNavigateToPetRoom?: () => void'), 'PetWidget must keep parent-driven pet-room navigation callback');
assert(petWidgetSource.includes('onNavigateToPetRoom?.()'), 'PetWidget must call parent-driven pet-room navigation callback');

console.log(JSON.stringify({ ok: true, checked: 'appv2-route-flow' }, null, 2));
