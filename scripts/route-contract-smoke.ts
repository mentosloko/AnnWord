import { isKnownRoute } from '../components/AppRouter';
import { ViewState } from '../types';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Route contract smoke test failed: ${message}`);
};

const requiredRoutes: ViewState[] = [
  'landing',
  'setup',
  'game',
  'anagram',
  'sprint',
  'memory',
  'hangman',
  'shop',
  'pet_room',
  'stats',
];

for (const route of requiredRoutes) {
  assert(isKnownRoute(route), `route must be known: ${route}`);
}

assert(!isKnownRoute('pet-room'), 'legacy hyphenated pet-room route must not be accepted');
assert(!isKnownRoute('unknown'), 'unknown route must not be accepted');

console.log(JSON.stringify({ ok: true, checked: 'route-contract', routes: requiredRoutes.length }, null, 2));
