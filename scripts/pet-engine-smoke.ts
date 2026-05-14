import { PetState, UserProfile } from '../types';
import { applyPetDecay, derivePetMood, getInventoryEmoji, getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Pet engine smoke test failed: ${message}`);
};

const happyPet: PetState = {
  name: 'Owl',
  type: 'Owl',
  level: 2,
  mood: 'happy',
  xp: 10,
  hunger: 90,
  energy: 90,
  equippedAccessories: []
};

assert(derivePetMood(90, 90) === 'excited', 'high hunger and energy should derive excited mood');
assert(derivePetMood(20, 90) === 'sad', 'low hunger should derive sad mood');
assert(derivePetMood(90, 15) === 'sad', 'low energy should derive sad mood');
assert(derivePetMood(50, 90) === 'neutral', 'mid hunger should derive neutral mood');

const snapshot = getPetNeedSnapshot(happyPet);
assert(snapshot.attentionLevel === 'ok', 'well-fed pet should be ok');
assert(snapshot.statusLabel === 'Всё хорошо', 'well-fed pet should have ok label');

const decayed = applyPetDecay(happyPet, {
  lastActiveMs: 0,
  nowMs: 1000 * 60 * 60 * 10,
  hungerLossPerHour: 3,
  energyLossPerHour: 2,
});
assert(decayed.hunger === 60, 'decay should reduce hunger by elapsed hours');
assert(decayed.energy === 70, 'decay should reduce energy by elapsed hours');
assert(decayed.mood === derivePetMood(decayed.hunger, decayed.energy), 'decay must refresh mood');

const profile: UserProfile = {
  username: 'Tester',
  role: 'user',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: happyPet,
  coins: 100,
  inventory: [
    { id: 'apple', type: 'food', name: 'Яблоко', quantity: 2 },
    { id: 'hat', type: 'accessory', name: 'Шляпа', quantity: 1 },
    { id: 'cake', type: 'food', name: 'Торт', quantity: 0 },
  ],
};

assert(getVisibleInventory(profile, 'food').length === 1, 'visible inventory must filter by type and positive quantity');
assert(getInventoryEmoji(profile.inventory[0]) === '🍎', 'apple emoji must be stable');
assert(getPetEmoji(happyPet) === '🦉', 'owl pet emoji must be stable');

console.log(JSON.stringify({ ok: true, checked: 'pet-engine' }, null, 2));
