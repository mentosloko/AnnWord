import { InventoryItem, PetState, UserProfile } from '../types';
import { deriveMoodFromScore, normalizeMoodScore } from './gamificationRules';

export type PetMood = PetState['mood'];

export interface PetNeedSnapshot {
  moodScore: number;
  mood: PetMood;
  statusLabel: string;
  attentionLevel: 'ok' | 'watch' | 'critical';
  hunger: number;
  energy: number;
}

export interface PetDecayOptions {
  nowMs?: number;
  lastActiveMs?: number | null;
  moodLossPerDay?: number;
  hungerLossPerHour?: number;
  energyLossPerHour?: number;
}

const clampNeed = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export const derivePetMood = (moodScoreOrHunger: number, legacyEnergy?: number): PetMood => {
  if (typeof legacyEnergy === 'number') {
    const legacyMoodScore = Math.min(moodScoreOrHunger, legacyEnergy);
    return deriveMoodFromScore(legacyMoodScore);
  }
  return deriveMoodFromScore(moodScoreOrHunger);
};

export const getPetNeedSnapshot = (pet: PetState): PetNeedSnapshot => {
  const moodScore = normalizeMoodScore(pet);
  const mood = deriveMoodFromScore(moodScore);

  if (moodScore <= 20) {
    return { moodScore, mood, statusLabel: 'Скучает', attentionLevel: 'critical', hunger: moodScore, energy: moodScore };
  }

  if (moodScore <= 45) {
    return { moodScore, mood, statusLabel: 'Спокойное настроение', attentionLevel: 'watch', hunger: moodScore, energy: moodScore };
  }

  if (moodScore <= 70) {
    return { moodScore, mood, statusLabel: 'Рад учиться', attentionLevel: 'ok', hunger: moodScore, energy: moodScore };
  }

  return { moodScore, mood, statusLabel: 'Супернастроение', attentionLevel: 'ok', hunger: moodScore, energy: moodScore };
};

export const applyPetDecay = (pet: PetState, options: PetDecayOptions = {}): PetState => {
  const nowMs = options.nowMs ?? Date.now();
  const lastActiveMs = options.lastActiveMs ?? nowMs;
  const elapsedDays = Math.max(0, (nowMs - lastActiveMs) / (1000 * 60 * 60 * 24));
  const moodLossPerDay = options.moodLossPerDay ?? 8;

  const moodScore = clampNeed(normalizeMoodScore(pet) - elapsedDays * moodLossPerDay);

  return {
    ...pet,
    moodScore,
    mood: deriveMoodFromScore(moodScore),
    hunger: moodScore,
    energy: moodScore,
  };
};

export const getInventoryEmoji = (item: InventoryItem): string => {
  switch (item.id) {
    case 'apple': return '🍎';
    case 'cookie': return '🍪';
    case 'berry': return '🫐';
    case 'icecream': return '🍦';
    case 'star_treat': return '⭐';
    case 'bow': return '🎀';
    case 'hat': return '🧢';
    case 'glasses': return '🕶️';
    case 'hero_cape': return '🦸';
    case 'star_collar': return '🌟';
    case 'crown': return '👑';
    case 'dog_house': return '🏠';
    case 'dragon_nest': return '🪺';
    case 'charging_station': return '🔋';
    case 'puppy': return '🐶';
    case 'dragon': return '🐲';
    case 'robo_cat': return '🤖';
    default: return '🎁';
  }
};

export const getPetEmoji = (pet: PetState): string => {
  if (pet.type === 'Puppy' || pet.name === 'Щенок') return '🐶';
  if (pet.type === 'Dragon' || pet.name === 'Дракончик' || pet.name === 'Дракон') return '🐲';
  if (pet.type === 'RoboCat' || pet.name === 'Робокот') return '🤖';
  if (pet.type === 'Owl') return '🦉';
  if (pet.type === 'Cat' || pet.name === 'Кот') return '🐱';
  return '🐾';
};

export const getVisibleInventory = (profile: UserProfile, type: InventoryItem['type']): InventoryItem[] =>
  (profile.inventory || []).filter(item => item.type === type && item.quantity > 0);
