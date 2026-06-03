import { FeatureFlags, InventoryItem, PetState, UserProfile, UserStats, WordPerformance } from '../types';
import { normalizeCustomDictionary } from './dictionaryEngine';
import { deriveCharacterLevel, deriveCharacterStage, deriveMoodFromScore, getTotalXpForLevel, normalizeMoodScore } from './gamificationRules';

const DEFAULT_PET: PetState = {
  name: 'Щенок', type: 'Puppy', level: 1, mood: 'happy', xp: 0, moodScore: 60, stage: 'stage_1', characterOnboarded: false,
  hunger: 100, energy: 100, equippedAccessories: [], activeWorldId: 'default_room', dailyStreak: 0, earnedStickerIds: [],
};
const DEFAULT_STATS: UserStats = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {}, wordsToReview: {}, wordPerformance: {} };
const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const normalizeStringArray = (value: unknown): string[] => Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))) : [];
const normalizeWordCounters = (value: unknown): Record<string, number> => isPlainObject(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number')) : {};
const normalizeFeatureFlags = (value: unknown): FeatureFlags => !isPlainObject(value) ? {} : ({
  adultRoom: value.adultRoom === true,
  premiumDictionaries: value.premiumDictionaries === true,
  dailyWorldReward: value.dailyWorldReward === true,
  treatRequests: value.treatRequests === true,
  streakStickers: value.streakStickers === true,
  levelWardrobe: value.levelWardrobe === true,
});
const normalizePerformance = (value: unknown): Record<string, WordPerformance> => {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => isPlainObject(item)).map(([key, item]) => [key, {
    word: typeof item.word === 'string' ? item.word : key,
    attempts: typeof item.attempts === 'number' ? item.attempts : 0,
    correct: typeof item.correct === 'number' ? item.correct : 0,
    mistakes: typeof item.mistakes === 'number' ? item.mistakes : 0,
    lastPracticedAt: typeof item.lastPracticedAt === 'string' ? item.lastPracticedAt : undefined,
  }]));
};

export const normalizeDictionaryField = (value: unknown): string[] => Array.isArray(value) ? normalizeCustomDictionary(value.filter((item): item is string => typeof item === 'string')) : [];
export const normalizeStats = (value: unknown): UserStats => !isPlainObject(value) ? { ...DEFAULT_STATS } : ({
  gamesPlayed: typeof value.gamesPlayed === 'number' ? value.gamesPlayed : 0,
  gamesWon: typeof value.gamesWon === 'number' ? value.gamesWon : 0,
  wordsGuessed: normalizeWordCounters(value.wordsGuessed),
  wordsToReview: normalizeWordCounters(value.wordsToReview),
  wordPerformance: normalizePerformance(value.wordPerformance),
});

export const normalizePet = (value: unknown, applyWardrobeMoodRule = false): PetState => {
  if (!isPlainObject(value)) return { ...DEFAULT_PET };
  const storedLevel = typeof value.level === 'number' ? Math.max(1, Math.round(value.level)) : DEFAULT_PET.level;
  const rawXp = typeof value.xp === 'number' ? Math.max(0, Math.round(value.xp)) : DEFAULT_PET.xp;
  const derivedLevel = deriveCharacterLevel(rawXp);
  const preserveLegacyLevel = rawXp === 0 && storedLevel > derivedLevel;
  const level = preserveLegacyLevel ? storedLevel : derivedLevel;
  const normalizedXp = preserveLegacyLevel ? getTotalXpForLevel(level) : rawXp;
  const basePet: PetState = {
    ...DEFAULT_PET,
    ...value,
    name: typeof value.name === 'string' ? value.name : DEFAULT_PET.name,
    type: typeof value.type === 'string' ? value.type : DEFAULT_PET.type,
    level, xp: normalizedXp,
    hunger: typeof value.hunger === 'number' ? value.hunger : DEFAULT_PET.hunger,
    energy: typeof value.energy === 'number' ? value.energy : DEFAULT_PET.energy,
    equippedAccessories: normalizeStringArray(value.equippedAccessories),
    activeHomeItemId: typeof value.activeHomeItemId === 'string' ? value.activeHomeItemId : undefined,
    activeWorldId: ['theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge'].includes(String(value.activeWorldId)) ? value.activeWorldId as PetState['activeWorldId'] : 'default_room',
    activeWorldDate: typeof value.activeWorldDate === 'string' ? value.activeWorldDate : undefined,
    dailyStreak: typeof value.dailyStreak === 'number' ? Math.max(0, Math.round(value.dailyStreak)) : 0,
    lastDailyActivityDate: typeof value.lastDailyActivityDate === 'string' ? value.lastDailyActivityDate : undefined,
    earnedStickerIds: normalizeStringArray(value.earnedStickerIds),
    requestedTreatId: typeof value.requestedTreatId === 'string' ? value.requestedTreatId : undefined,
    characterOnboarded: value.characterOnboarded === true,
    stage: deriveCharacterStage(level),
  };
  const moodScore = normalizeMoodScore({ ...basePet, mood: ['sad', 'neutral', 'calm', 'happy', 'excited', 'joyful', 'super_happy'].includes(String(value.mood)) ? value.mood as PetState['mood'] : DEFAULT_PET.mood, moodScore: typeof value.moodScore === 'number' ? value.moodScore : undefined });
  return { ...basePet, equippedAccessories: applyWardrobeMoodRule && moodScore < 34 ? [] : basePet.equippedAccessories, moodScore, mood: deriveMoodFromScore(moodScore) };
};

export const normalizeInventory = (value: unknown): InventoryItem[] => Array.isArray(value) ? value.filter(isPlainObject).map(item => ({
  id: typeof item.id === 'string' ? item.id : '',
  type: ['food', 'pet', 'accessory', 'home', 'mystery', 'sticker'].includes(String(item.type)) ? item.type as InventoryItem['type'] : 'food',
  name: typeof item.name === 'string' ? item.name : '', quantity: typeof item.quantity === 'number' ? item.quantity : 1,
  metadata: isPlainObject(item.metadata) ? { imageUrl: String(item.metadata.imageUrl || ''), minLevel: typeof item.metadata.minLevel === 'number' ? item.metadata.minLevel : undefined, temporary: item.metadata.temporary === true } : undefined,
})).filter(item => item.id && item.name && item.quantity > 0) : [];

export const mapProfileFromDB = (data: any): UserProfile => {
  const featureFlags = normalizeFeatureFlags(data?.feature_flags);
  return {
    username: typeof data?.username === 'string' && data.username.trim() ? data.username : 'Гость',
    role: ['admin', 'parent', 'teacher'].includes(String(data?.role)) ? data.role : 'user',
    accountMode: ['player', 'parent', 'teacher'].includes(String(data?.account_mode)) ? data.account_mode : undefined,
    subscriptionTier: data?.subscription_tier === 'premium' ? 'premium' : 'free',
    premiumExpiresAt: typeof data?.premium_expires_at === 'string' ? data.premium_expires_at : undefined,
    childDisplayName: typeof data?.child_display_name === 'string' ? data.child_display_name : undefined,
    childShareCode: typeof data?.child_share_code === 'string' ? data.child_share_code : undefined,
    childSlotsLimit: typeof data?.child_slots_limit === 'number' ? data.child_slots_limit : 1,
    featureFlags,
    customDictionaryEn: normalizeDictionaryField(data?.custom_dictionary_en),
    dictionaryCollections: Array.isArray(data?.dictionary_collections) ? data.dictionary_collections : [],
    managedLearners: Array.isArray(data?.managed_learners) ? data.managed_learners : [],
    weeklyReportEmail: typeof data?.weekly_report_email === 'string' ? data.weekly_report_email : undefined,
    stats: normalizeStats(data?.stats),
    pet: normalizePet(data?.pet, featureFlags.levelWardrobe === true),
    coins: typeof data?.coins === 'number' ? data.coins : 0,
    inventory: normalizeInventory(data?.inventory),
  };
};
