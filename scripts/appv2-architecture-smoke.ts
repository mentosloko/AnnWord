import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(`AppV2 architecture smoke failed: ${message}`);
};

const app = read('AppV2.tsx');
const screens = read('components/AppScreens.tsx');
const shell = read('components/AppShell.tsx');
const landing = read('components/screens/LandingScreen.tsx');
const profile = read('components/screens/ProfileScreen.tsx');
const shop = read('components/Shop.tsx');
const room = read('components/PetRoom.tsx');

assert(app.includes('<AppShell') && app.includes('<AppScreens'), 'AppV2 screen composition');
assert(shell.includes('<AppHeader') && shell.includes('<AppModals'), 'shell composition');
for (const route of ['landing:', 'setup:', 'game:', 'profile:', 'anagrams:', 'sprint:', 'memory:', 'hangman:', 'shop:', 'pet_room:']) {
  assert(screens.includes(route), `route ${route}`);
}
for (const navigation of [
  "onStartClassic={() => openSetupFor('game')}",
  "onStartHangman={() => openSetupFor('hangman')}",
  "onOpenPetRoom={() => onRouteChange('pet_room')}",
  "shop: isParentAccount ? <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} onOpenPetRoom={() => onRouteChange('pet_room')} /> : homeScreen",
  "pet_room: isParentAccount ? <PetRoom userProfile={userProfile} onUseItem={onUseItem} onBuy={onBuy} onUpdatePet={onUpdatePet} onClose={goHome} onOpenShop={() => onRouteChange('shop')} /> : homeScreen",
]) {
  assert(screens.includes(navigation), `wiring ${navigation}`);
}
assert(screens.includes('const isParentAccount = userProfile.role === \'parent\' || userProfile.accountMode === \'parent\''), 'parent-only Kids route gating');
assert(landing.includes('onOpenPetRoom') && landing.includes('getPuppyCharacterAssetUrl'), 'landing pet entry');
assert(profile.includes('onOpenPetRoom'), 'profile pet entry');
assert(shop.includes('onClose: () => void') && shop.includes('onClick={onClose}'), 'shop close contract');
assert(shop.includes('onOpenPetRoom') && shop.includes('onClick={onOpenPetRoom}'), 'shop pet room shortcut contract');
assert((room.includes('onClose:()=>void') || room.includes('onClose: () => void')) && room.includes('onClick={onClose}'), 'pet room close contract');
assert(room.includes('onUpdatePet') && room.includes('onOpenShop'), 'pet room update/shop contract');
assert(room.includes('overflow-x-auto'), 'mobile room horizontal scrolling');
console.log(JSON.stringify({ ok: true, checked: 'appv2-route-flow' }, null, 2));
