import {
  canGoBack,
  createInitialNavigationState,
  isSecondaryScreen,
  navigateBack,
  navigateHome,
  navigateToScreen,
} from '../services/navigation';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Navigation smoke test failed: ${message}`);
};

const initial = createInitialNavigationState();
assert(initial.currentScreen === 'home', 'initial screen must be home');
assert(!canGoBack(initial), 'initial state must not have back target');

const shop = navigateToScreen(initial, 'shop');
assert(shop.currentScreen === 'shop', 'must navigate to shop');
assert(shop.previousScreen === 'home', 'shop previous screen must be home');
assert(canGoBack(shop), 'shop must have back target');
assert(isSecondaryScreen('shop'), 'shop must be secondary screen');

const backFromShop = navigateBack(shop);
assert(backFromShop.currentScreen === 'home', 'back from shop must return home');

const pet = navigateToScreen(initial, 'pet');
assert(navigateHome(pet).currentScreen === 'home', 'navigateHome from pet must return home');

const settings = navigateToScreen(shop, 'settings');
assert(settings.previousScreen === 'shop', 'previous screen should update on chained navigation');
assert(navigateBack(settings).currentScreen === 'shop', 'back should return to previous screen');

const backWithoutPrevious = navigateBack(initial);
assert(backWithoutPrevious.currentScreen === 'home', 'back without previous must safely stay/go home');

console.log(JSON.stringify({ ok: true, checked: 'navigation', routes: ['home', 'shop', 'pet', 'settings'] }, null, 2));
