import { EGG_HATCH_WORDS_REQUIRED, STARTER_PET_ARCHETYPES } from './worldCatalog';
import { PetKind, PetProgressState, PetStage } from './worldTypes';

export const getPetStage = (kind: PetKind, level: number): PetStage => {
  if (kind === 'egg') return 'egg';
  if (level <= 5) return 'baby';
  if (level <= 12) return 'teen';
  return 'master';
};

export const getEggHatchProgress = (guessedWordsSinceRegistration: number, requiredWords = EGG_HATCH_WORDS_REQUIRED) => {
  const safeRequired = Math.max(1, requiredWords);
  const current = Math.max(0, guessedWordsSinceRegistration);
  return {
    current: Math.min(current, safeRequired),
    required: safeRequired,
    ready: current >= safeRequired,
  };
};

export const canHatchEgg = (state: PetProgressState, requiredWords = EGG_HATCH_WORDS_REQUIRED): boolean =>
  state.kind === 'egg' && !state.hatched && getEggHatchProgress(state.guessedWordsSinceRegistration, requiredWords).ready;

export const pickStarterPet = (random: () => number = Math.random): Exclude<PetKind, 'egg'> => {
  const starters = STARTER_PET_ARCHETYPES.filter(pet => pet.starter && pet.id !== 'egg');
  const index = Math.min(starters.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * starters.length));
  return starters[index].id as Exclude<PetKind, 'egg'>;
};

export const hatchEgg = (
  state: PetProgressState,
  random: () => number = Math.random,
  requiredWords = EGG_HATCH_WORDS_REQUIRED,
): { state: PetProgressState; hatchedPetKind: Exclude<PetKind, 'egg'> | null } => {
  if (!canHatchEgg(state, requiredWords)) return { state, hatchedPetKind: null };
  const hatchedPetKind = pickStarterPet(random);
  return {
    state: {
      ...state,
      kind: hatchedPetKind,
      hatched: true,
    },
    hatchedPetKind,
  };
};
