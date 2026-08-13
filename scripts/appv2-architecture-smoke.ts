import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(`AppV2 architecture smoke failed: ${message}`);
};

const app = read('AppV2.tsx');
const screens = read('components/AppScreens.tsx');
const shell = read('components/AppShell.tsx');
const landing = read('components/screens/LandingMixScreen.tsx');
const profile = read('components/screens/ProfileScreen.tsx');
const shop = read('components/Shop.tsx');
const room = read('components/PetRoom.tsx');

assert(app.includes('<AppShell') && app.includes('<AppScreens'), 'AppV2 screen composition');
assert(shell.includes('<AppHeader') && shell.includes('<AppModals'), 'shell composition');
assert(screens.includes("import { LandingMixScreen }"), 'current public landing composition');
for (const route of ['landing:', 'setup:', 'game:', 'profile:', 'anagrams:', 'sprint:', 'memory:', 'hangman:', 'shop:', 'pet_room:']) {
  assert(screens.includes(route), `route ${route}`);
}

for (const navigation of [
  "onStartClassic={() => requestQuickLaunch('game')}",
  "onStartHangman={() => requestQuickLaunch('hangman')}",
  "onOpenPetRoom={() => onRouteChange('pet_room')}",
  "shop: isParentAccount ? <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} onOpenPetRoom={() => onRouteChange('pet_room')} /> : homeScreen",
]) {
  assert(screens.includes(navigation), `wiring ${navigation}`);
}

assert(screens.includes("const requestQuickLaunch = (mode: PlayableModeRoute) =>"), 'shared game quick-launch setup gate');
assert(screens.includes("onRouteChange('setup');"), 'quick launch routes through shared setup');
assert(screens.includes("pet_room: isParentAccount ?"), 'parent-only pet room route');
assert(screens.includes('<PetRoom userProfile={userProfile}') && screens.includes("onOpenShop={() => onRouteChange('shop')}"), 'pet room wiring');
assert(screens.includes("const isParentAccount = userProfile.role === 'parent' || userProfile.accountMode === 'parent'"), 'parent-only Kids route gating');

assert(landing.includes('Задали английские слова? Пусть ребёнок выучит их играючи.'), 'parent-first public landing');
assert(landing.includes('Создать аккаунт преподавателя'), 'teacher public entry');
assert(profile.includes('onOpenPetRoom'), 'profile pet entry');
assert(shop.includes('onClose: () => void') && shop.includes('onClick={onClose}'), 'shop close contract');
assert(shop.includes('onOpenPetRoom?: () => void') && shop.includes('const goPetRoom = () => { onClose(); onOpenPetRoom?.(); };'), 'shop pet room shortcut contract');
assert(shop.includes('<PurchaseCelebrationModal') && shop.includes('onOpenPetRoom={onOpenPetRoom}'), 'purchase celebration forwards pet room navigation');
assert((room.includes('onClose:()=>void') || room.includes('onClose: () => void')) && room.includes('onClick={onClose}'), 'pet room close contract');
assert(room.includes('onUpdatePet') && room.includes('onOpenShop'), 'pet room update/shop contract');
assert(room.includes('overflow-x-auto'), 'mobile room horizontal scrolling');

console.log(JSON.stringify({ ok: true, checked: 'appv2-current-route-flow' }, null, 2));
