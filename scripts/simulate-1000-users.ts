import { applyGameRewardToCharacter, calculateGameReward, normalizeMoodScore } from '../services/gamificationRules';
import { applyItemUseLocally, applyPurchaseLocally } from '../services/economyEngine';
import { SHOP_ITEMS, getShopItemById } from '../services/shopCatalog';
import { buildSprintDictionary } from '../components/SprintGame';
import { buildAnagramDictionary } from '../components/AnagramGame';
import { buildMemoryDictionary, createMemoryCards } from '../components/MemoryGame';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { GameRewardInput, InventoryItem, PetState, UserProfile, UserStats } from '../types';

const USERS = Number(process.env.SIM_USERS || 1000);
const STEPS_PER_USER = Number(process.env.SIM_STEPS || 180);
const SEED = Number(process.env.SIM_SEED || 20260526);

interface Failure {
  userIndex: number;
  step: number;
  action: string;
  message: string;
  profile: Pick<UserProfile, 'username' | 'coins' | 'inventory'> & { pet: PetState; stats: UserStats };
}

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const random = createRandom(SEED);
const failures: Failure[] = [];

const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
const chance = (probability: number) => random() < probability;

const createProfile = (index: number): UserProfile => {
  const pet: PetState = {
    name: `Тестик ${index}`,
    type: 'Puppy',
    level: 1 + Math.floor(random() * 8),
    mood: 'happy',
    xp: Math.floor(random() * 900),
    moodScore: 35 + Math.floor(random() * 40),
    stage: 'stage_1',
    characterOnboarded: true,
    equippedAccessories: [],
  };

  const inventory: InventoryItem[] = [];
  if (chance(0.55)) inventory.push({ id: 'apple', name: 'Энерго-яблоко', type: 'food', quantity: 1 + Math.floor(random() * 4) });
  if (chance(0.35)) inventory.push({ id: 'cookie', name: 'Хрустик', type: 'food', quantity: 1 + Math.floor(random() * 3) });
  if (chance(0.2)) inventory.push({ id: 'bow', name: 'Бантик', type: 'accessory', quantity: 1 });

  const stats: UserStats = {
    gamesPlayed: Math.floor(random() * 20),
    gamesWon: 0,
    wordsGuessed: {},
  };
  stats.gamesWon = Math.floor(random() * (stats.gamesPlayed + 1));

  return {
    username: `sim_user_${index}`,
    role: 'user',
    customDictionaryEn: chance(0.5)
      ? ['APPLE', 'HOUSE', 'TRAIN', 'YUMMY', 'TSHIRT', 'GNOME', 'FRUITS']
      : [],
    stats,
    pet,
    coins: Math.floor(random() * 60),
    inventory,
  };
};

const snapshot = (profile: UserProfile): Failure['profile'] => ({
  username: profile.username,
  coins: profile.coins,
  inventory: profile.inventory,
  stats: profile.stats,
  pet: profile.pet,
});

const assertInvariant = (profile: UserProfile, userIndex: number, step: number, action: string) => {
  const fail = (message: string) => failures.push({ userIndex, step, action, message, profile: snapshot(profile) });

  if (profile.coins < 0) fail('coins must never be negative');
  if (profile.pet.xp < 0) fail('pet xp must never be negative');
  if ((profile.pet.level || 1) < 1) fail('pet level must be at least 1');

  const moodScore = normalizeMoodScore(profile.pet);
  if (moodScore < 0 || moodScore > 100) fail('pet mood score must stay within 0..100');

  if (profile.stats.gamesWon > profile.stats.gamesPlayed) fail('gamesWon must not exceed gamesPlayed');

  for (const item of profile.inventory) {
    if (!item.id) fail('inventory item must have id');
    if (item.quantity < 1) fail(`inventory item ${item.id} must have positive quantity`);
  }

  const equipped = profile.pet.equippedAccessories || [];
  if (equipped.length > 2) fail('pet must not have more than 2 equipped accessories');
  if (new Set(equipped).size !== equipped.length) fail('equipped accessories must not contain duplicates');
};

const applyReward = (profile: UserProfile, input: GameRewardInput): UserProfile => {
  const reward = calculateGameReward(input);
  const progress = applyGameRewardToCharacter(profile.pet, reward);
  const won = Boolean(input.won) || (input.type === 'sprint' || input.type === 'anagram' || input.type === 'memory') && (input.guessedWords || input.clicks || 0) > 0;
  return {
    ...profile,
    coins: Math.max(0, profile.coins + reward.coins),
    pet: progress.pet,
    stats: {
      ...profile.stats,
      gamesPlayed: profile.stats.gamesPlayed + 1,
      gamesWon: profile.stats.gamesWon + (won ? 1 : 0),
    },
  };
};

const buyRandomAffordableItem = (profile: UserProfile): UserProfile => {
  const candidates = SHOP_ITEMS.filter(item => item.price <= profile.coins && (profile.pet.level || 1) >= item.minLevel);
  if (candidates.length === 0) return profile;
  const result = applyPurchaseLocally(profile, pick(candidates), random);
  return result.ok && result.profile ? result.profile : profile;
};

const useRandomItem = (profile: UserProfile): UserProfile => {
  if (profile.inventory.length === 0) return profile;
  const item = pick(profile.inventory);
  const beforeMood = normalizeMoodScore(profile.pet);
  const result = applyItemUseLocally(profile, item.id);
  if (!result.ok || !result.profile) return profile;
  const afterMood = normalizeMoodScore(result.profile.pet);
  if (item.type === 'food' && afterMood < beforeMood) {
    failures.push({
      userIndex: -1,
      step: -1,
      action: `use:${item.id}`,
      message: 'food treat must not lower mood',
      profile: snapshot(result.profile),
    });
  }
  return result.profile;
};

const validateDictionaries = (profile: UserProfile, userIndex: number, step: number) => {
  const sprintDictionary = buildSprintDictionary(profile.customDictionaryEn);
  const playableTranslations = sprintDictionary.filter(entry => /[А-Яа-яЁё]/.test(entry.translation));
  if (profile.customDictionaryEn.length > 0 && playableTranslations.length === 0) {
    failures.push({ userIndex, step, action: 'dictionary:sprint', message: 'sprint must have Russian translations or fallback available', profile: snapshot(profile) });
  }

  const anagramDictionary = buildAnagramDictionary(profile.customDictionaryEn);
  if (anagramDictionary.length === 0) {
    failures.push({ userIndex, step, action: 'dictionary:anagram', message: 'anagram dictionary must not be empty', profile: snapshot(profile) });
  }

  const memoryDictionary = buildMemoryDictionary(profile.customDictionaryEn);
  const cards = createMemoryCards(memoryDictionary, random);
  const pairIds = new Set(cards.map(card => card.pairId));
  if (cards.length !== Math.min(12, memoryDictionary.length * 2)) {
    failures.push({ userIndex, step, action: 'dictionary:memory', message: 'memory card count must match selected pairs', profile: snapshot(profile) });
  }
  if (cards.length !== pairIds.size * 2) {
    failures.push({ userIndex, step, action: 'dictionary:memory', message: 'memory cards must have exactly two cards per pair', profile: snapshot(profile) });
  }
};

const simulateAction = (profile: UserProfile, action: string, userIndex: number, step: number): UserProfile => {
  switch (action) {
    case 'wordle-win': return applyReward(profile, { type: 'wordle', won: true, coinsAdjustment: chance(0.3) ? -1 : 0 });
    case 'wordle-lose': return applyReward(profile, { type: 'wordle', won: false, coinsAdjustment: chance(0.3) ? -2 : 0 });
    case 'sprint': return applyReward(profile, { type: 'sprint', guessedWords: Math.floor(random() * 8) });
    case 'anagram': return applyReward(profile, { type: 'anagram', guessedWords: chance(0.8) ? 1 : 0 });
    case 'memory': return applyReward(profile, { type: 'memory', clicks: 8 + Math.floor(random() * 28) });
    case 'hangman': return applyReward(profile, { type: 'hangman', won: chance(0.65) });
    case 'buy': return buyRandomAffordableItem(profile);
    case 'use-item': return useRandomItem(profile);
    case 'dictionary': validateDictionaries(profile, userIndex, step); return profile;
    case 'manual-cookie': {
      const cookie = getShopItemById('cookie');
      if (!cookie) return profile;
      const bought = applyPurchaseLocally({ ...profile, coins: profile.coins + cookie.price }, cookie, random);
      return bought.ok && bought.profile ? bought.profile : profile;
    }
    default: return profile;
  }
};

const actions = ['wordle-win', 'wordle-lose', 'sprint', 'anagram', 'memory', 'hangman', 'buy', 'use-item', 'dictionary', 'manual-cookie'];

for (let userIndex = 0; userIndex < USERS; userIndex += 1) {
  let profile = createProfile(userIndex);
  assertInvariant(profile, userIndex, 0, 'initial');

  for (let step = 1; step <= STEPS_PER_USER; step += 1) {
    const action = pick(actions);
    try {
      profile = simulateAction(profile, action, userIndex, step);
      assertInvariant(profile, userIndex, step, action);
    } catch (error: any) {
      failures.push({ userIndex, step, action, message: error?.message || String(error), profile: snapshot(profile) });
    }
  }
}

if (failures.length > 0) {
  console.error(`Simulation failed: ${failures.length} invariant violation(s).`);
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  process.exit(1);
}

console.log(`Simulation passed: ${USERS} users × ${STEPS_PER_USER} steps, seed=${SEED}.`);
