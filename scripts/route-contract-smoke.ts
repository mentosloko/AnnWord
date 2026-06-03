import { isKnownRoute, KNOWN_ROUTES } from '../components/AppRouter';
import { ViewState } from '../types';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Route contract smoke test failed: ${message}`);
};

const requiredRoutes: ViewState[] = [
  'landing',
  'profile',
  'setup',
  'game',
  'review',
  'anagrams',
  'sprint',
  'memory',
  'hangman',
  'shop',
  'pet_room',
  'account_mode_setup',
  'character_onboarding',
  'family_setup',
  'adult_room',
  'dictionary_studio',
  'admin',
];

for (const route of requiredRoutes) {
  assert(isKnownRoute(route), `route must be known: ${route}`);
}

assert(KNOWN_ROUTES.length === requiredRoutes.length, 'KNOWN_ROUTES must match ViewState route count');
assert(!isKnownRoute('anagram'), 'legacy singular anagram route must not be accepted');
assert(!isKnownRoute('petroom'), 'legacy petroom route must not be accepted');
assert(!isKnownRoute('pet-room'), 'legacy hyphenated pet-room route must not be accepted');
assert(!isKnownRoute('stats'), 'legacy stats route must not be accepted unless ViewState includes it');
assert(!isKnownRoute('unknown'), 'unknown route must not be accepted');

console.log(JSON.stringify({ ok: true, checked: 'route-contract', routes: requiredRoutes.length }, null, 2));
