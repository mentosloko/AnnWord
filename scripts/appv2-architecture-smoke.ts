import { existsSync, readFileSync } from 'node:fs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`AppV2 architecture smoke failed: ${message}`);
};

const read = (path: string) => readFileSync(path, 'utf8');

const indexSource = read('index.tsx');
const appSource = read('AppV2.tsx');
const appShellSource = read('components/AppShell.tsx');
const appScreensSource = read('components/AppScreens.tsx');
const shopSource = read('components/Shop.tsx');
const petRoomSource = read('components/PetRoom.tsx');
const petWidgetSource = read('components/PetWidget.tsx');

assert(indexSource.includes("import App from './AppV2'"), 'index.tsx must mount AppV2');
assert(!indexSource.includes("import App from './App'"), 'index.tsx must not mount legacy App.tsx');

const removedLegacyFiles = [
  'App.tsx',
  'components/AppProviders.tsx',
  'components/LegacyAppBridge.tsx',
  'providers/AuthProvider.tsx',
  'providers/ProfileProvider.tsx',
  'providers/NavigationProvider.tsx',
  'utils/navigationBridge.ts',
];

for (const path of removedLegacyFiles) {
  assert(!existsSync(path), `${path} should stay removed after AppV2 migration`);
}

const authProfileSource = read('hooks/useAuthProfile.ts');
assert(
  authProfileSource.includes("../constants/profileDefaults"),
  'useAuthProfile should depend on neutral profile defaults, not legacy ProfileProvider',
);
assert(
  !authProfileSource.includes('../providers/ProfileProvider'),
  'useAuthProfile must not depend on legacy ProfileProvider',
);

assert(appSource.includes("import { AppShell } from './components/AppShell'"), 'AppV2 must compose AppShell');
assert(appSource.includes('AppScreens') && appSource.includes("from './components/AppScreens'"), 'AppV2 must compose AppScreens');
assert(appSource.includes('selectedPlayMode'), 'AppV2 must keep selected game mode state for shared setup');
assert(appSource.includes('<AppShell'), 'AppV2 must render AppShell');
assert(appSource.includes('<AppScreens'), 'AppV2 must render AppScreens');

const requiredRouteFragments = [
  'landing:',
  'setup:',
  'game:',
  'profile:',
  'anagrams:',
  'sprint:',
  'memory:',
  'hangman:',
  'shop:',
  'pet_room:',
];

for (const fragment of requiredRouteFragments) {
  assert(appScreensSource.includes(fragment), `AppScreens route map must include ${fragment}`);
}

const requiredNavigationFragments = [
  "onStartClassic={() => openSetupFor('game')}",
  "onStartAnagrams={() => openSetupFor('anagrams')}",
  "onStartSprint={() => openSetupFor('sprint')}",
  "onStartHangman={() => openSetupFor('hangman')}",
  "onStartMemory={() => openSetupFor('memory')}",
  "onOpenShop={() => onRouteChange('shop')}",
  "onOpenProfile={() => onRouteChange('profile')}",
  "shop: <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} />",
  "pet_room: <PetRoom userProfile={userProfile} onUseItem={onUseItem} onClose={goHome} />",
];

for (const fragment of requiredNavigationFragments) {
  assert(appScreensSource.includes(fragment), `AppScreens must keep route wiring: ${fragment}`);
}

const sharedSetupFragments = [
  'selectedPlayMode',
  'openSetupFor',
  'startSelectedMode',
  "if (selectedPlayMode === 'game')",
  'classicGame.startNewGame();',
  'onRouteChange(selectedPlayMode);',
];

for (const fragment of sharedSetupFragments) {
  assert(appScreensSource.includes(fragment), `AppScreens must keep shared setup flow: ${fragment}`);
}

const requiredShellFragments = [
  '<AppHeader',
  '<AppModals',
  '<PetWidget',
  "route !== 'pet_room' && route !== 'shop'",
  'onNavigateToPetRoom={onNavigateToPetRoom}',
];

for (const fragment of requiredShellFragments) {
  assert(appShellSource.includes(fragment), `AppShell must keep layout wiring: ${fragment}`);
}

const forbiddenLegacyFragments = [
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

for (const [path, source] of [
  ['AppV2.tsx', appSource],
  ['components/AppShell.tsx', appShellSource],
  ['components/AppScreens.tsx', appScreensSource],
  ['components/Shop.tsx', shopSource],
  ['components/PetRoom.tsx', petRoomSource],
  ['components/PetWidget.tsx', petWidgetSource],
] as const) {
  for (const fragment of forbiddenLegacyFragments) {
    assert(!source.includes(fragment), `${path} must not depend on legacy fragment: ${fragment}`);
  }
}

assert(shopSource.includes('onClose: () => void'), 'Shop must keep explicit onClose callback contract');
assert(shopSource.includes('onClick={onClose}'), 'Shop back buttons must close through parent callback');
assert(petRoomSource.includes('onClose: () => void'), 'PetRoom must keep explicit onClose callback contract');
assert(petRoomSource.includes('onClick={onClose}'), 'PetRoom back button must close through parent callback');
assert(petWidgetSource.includes('onNavigateToPetRoom?: () => void'), 'PetWidget must keep parent-driven pet-room navigation callback');
assert(petWidgetSource.includes('onNavigateToPetRoom?.()'), 'PetWidget must call parent-driven pet-room navigation callback');

console.log(JSON.stringify({ ok: true, checked: 'appv2-shell-screens-shared-setup-route-flow' }, null, 2));
