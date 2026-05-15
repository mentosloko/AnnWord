import { PetState, UserProfile } from '../types';
import { applyPetDecay, derivePetMood, getInventoryEmoji, getPetEmoji, getPetNeedSnapshot, getVisibleInventory } from '../services/petEngine';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Pet engine smoke test failed: ${message}`);
};

const happyPet: PetState = {
  name: 'Щенок',
  type: 'Puppy',
  level: 2,
  mood: 'happy',
  xp: 10,
  moodScore: 65,
  stage: 'stage_1',
  hunger: 65,
  energy: 65,
  equippedAccessories: []
};

assert(derivePetMood(95) === 'super_happy', 'very high mood score should derive super_happy mood');
assert(derivePetMood(15) === 'sad', 'low mood score should derive sad mood');
assert(derivePetMood(40) === 'calm', 'mid-low mood score should derive calm mood');
assert(derivePetMood(60) === 'happy', 'mid mood score should derive happy mood');

const snapshot = getPetNeedSnapshot(happyPet);
assert(snapshot.attentionLevel === 'ok', 'happy character should be ok');
assert(snapshot.statusLabel === 'Рад учиться', 'happy character should have learning-ready label');

const decayed = applyPetDecay(happyPet, {
  lastActiveMs: 0,
  nowMs: 1000 * 60 * 60 * 24 * 2,
  moodLossPerDay: 8,
});
assert(decayed.moodScore === 49, 'decay should reduce mood by elapsed days');
assert(decayed.mood === derivePetMood(decayed.moodScore || 0), 'decay must refresh mood');

const profile: UserProfile = {
  username: 'Tester',
  role: 'user',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: happyPet,
  coins: 10,
  inventory: [
    { id: 'apple', type: 'food', name: 'Яблоко', quantity: 2 },
    { id: 'hat', type: 'accessory', name: 'Шапочка', quantity: 1 },
    { id: 'dog_house', type: 'home', name: 'Будка', quantity: 1 },
    { id: 'cookie', type: 'food', name: 'Печенье', quantity: 0 },
  ],
};

assert(getVisibleInventory(profile, 'food').length === 1, 'visible inventory must filter by type and positive quantity');
assert(getVisibleInventory(profile, 'home').length === 1, 'visible inventory must include home items');
assert(getInventoryEmoji(profile.inventory[0]) === '🍎', 'apple emoji must be stable');
assert(getPetEmoji(happyPet) === '🐶', 'puppy emoji must be stable');

console.log(JSON.stringify({ ok: true, checked: 'pet-engine' }, null, 2));
