import { InventoryItem, PetState, UserProfile } from '../types';

export type PetMood = PetState['mood'];

export interface PetNeedSnapshot {
  hunger: number;
  energy: number;
  mood: PetMood;
  statusLabel: string;
  attentionLevel: 'ok' | 'watch' | 'critical';
}

export interface PetDecayOptions {
  nowMs?: number;
  lastActiveMs?: number | null;
  hungerLossPerHour?: number;
  energyLossPerHour?: number;
}

const clampNeed = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export const derivePetMood = (hunger: number, energy: number): PetMood => {
  if (hunger < 25 || energy < 20) return 'sad';
  if (hunger < 55 || energy < 45) return 'neutral';
  if (hunger > 85 && energy > 80) return 'excited';
  return 'happy';
};

export const getPetNeedSnapshot = (pet: PetState): PetNeedSnapshot => {
  const hunger = clampNeed(pet.hunger ?? 100);
  const energy = clampNeed(pet.energy ?? 100);
  const mood = derivePetMood(hunger, energy);

  if (hunger < 25 || energy < 20) {
    return { hunger, energy, mood, statusLabel: 'Нужна забота', attentionLevel: 'critical' };
  }

  if (hunger < 55 || energy < 45) {
    return { hunger, energy, mood, statusLabel: 'Стоит покормить', attentionLevel: 'watch' };
  }

  return { hunger, energy, mood, statusLabel: 'Всё хорошо', attentionLevel: 'ok' };
};

export const applyPetDecay = (pet: PetState, options: PetDecayOptions = {}): PetState => {
  const nowMs = options.nowMs ?? Date.now();
  const lastActiveMs = options.lastActiveMs ?? nowMs;
  const elapsedHours = Math.max(0, (nowMs - lastActiveMs) / (1000 * 60 * 60));
  const hungerLossPerHour = options.hungerLossPerHour ?? 2;
  const energyLossPerHour = options.energyLossPerHour ?? 1;

  const hunger = clampNeed((pet.hunger ?? 100) - elapsedHours * hungerLossPerHour);
  const energy = clampNeed((pet.energy ?? 100) - elapsedHours * energyLossPerHour);

  return {
    ...pet,
    hunger,
    energy,
    mood: derivePetMood(hunger, energy),
  };
};

export const getInventoryEmoji = (item: InventoryItem): string => {
  switch (item.id) {
    case 'apple': return '🍎';
    case 'cake': return '🍰';
    case 'steak': return '🥩';
    case 'hat': return '🎩';
    case 'glasses': return '🕶️';
    case 'cat': return '🐱';
    case 'dragon': return '🐲';
    default: return '🎁';
  }
};

export const getPetEmoji = (pet: PetState): string => {
  if (pet.type === 'Owl') return '🦉';
  if (pet.type === 'Cat' || pet.name === 'Кот') return '🐱';
  if (pet.type === 'Dragon' || pet.name === 'Дракон') return '🐲';
  return '🐾';
};

export const getVisibleInventory = (profile: UserProfile, type: InventoryItem['type']): InventoryItem[] =>
  (profile.inventory || []).filter(item => item.type === type && item.quantity > 0);
