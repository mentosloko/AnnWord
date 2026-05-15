import { describe, expect, it } from 'vitest';
import { EGG_HATCH_WORDS_REQUIRED } from '../services/worldCatalog';
import { canHatchEgg, getEggHatchProgress, getPetStage, hatchEgg, pickStarterPet } from '../services/petProgressionEngine';
import { PetProgressState } from '../services/worldTypes';

const eggState = (guessedWordsSinceRegistration: number): PetProgressState => ({
  kind: 'egg',
  level: 1,
  guessedWordsSinceRegistration,
  hatched: false,
});

describe('petProgressionEngine', () => {
  it('maps pet level ranges to visual stages', () => {
    expect(getPetStage('egg', 99)).toBe('egg');
    expect(getPetStage('owl', 1)).toBe('baby');
    expect(getPetStage('fox', 5)).toBe('baby');
    expect(getPetStage('dino', 6)).toBe('teen');
    expect(getPetStage('owl', 12)).toBe('teen');
    expect(getPetStage('fox', 13)).toBe('master');
  });

  it('tracks egg hatch progress with clamped current value', () => {
    expect(getEggHatchProgress(0)).toEqual({ current: 0, required: EGG_HATCH_WORDS_REQUIRED, ready: false });
    expect(getEggHatchProgress(EGG_HATCH_WORDS_REQUIRED - 1).ready).toBe(false);
    expect(getEggHatchProgress(EGG_HATCH_WORDS_REQUIRED)).toEqual({ current: EGG_HATCH_WORDS_REQUIRED, required: EGG_HATCH_WORDS_REQUIRED, ready: true });
    expect(getEggHatchProgress(999).current).toBe(EGG_HATCH_WORDS_REQUIRED);
  });

  it('allows hatching only for unhatched eggs with enough guessed words', () => {
    expect(canHatchEgg(eggState(EGG_HATCH_WORDS_REQUIRED - 1))).toBe(false);
    expect(canHatchEgg(eggState(EGG_HATCH_WORDS_REQUIRED))).toBe(true);
    expect(canHatchEgg({ ...eggState(EGG_HATCH_WORDS_REQUIRED), hatched: true })).toBe(false);
    expect(canHatchEgg({ ...eggState(EGG_HATCH_WORDS_REQUIRED), kind: 'owl' })).toBe(false);
  });

  it('selects starter pets deterministically when random is injected', () => {
    expect(pickStarterPet(() => 0)).toBe('owl');
    expect(pickStarterPet(() => 0.34)).toBe('fox');
    expect(pickStarterPet(() => 0.99)).toBe('dino');
  });

  it('hatches ready egg without mutating blocked eggs', () => {
    const blocked = hatchEgg(eggState(EGG_HATCH_WORDS_REQUIRED - 1), () => 0);
    expect(blocked.hatchedPetKind).toBeNull();
    expect(blocked.state.kind).toBe('egg');

    const hatched = hatchEgg(eggState(EGG_HATCH_WORDS_REQUIRED), () => 0.99);
    expect(hatched.hatchedPetKind).toBe('dino');
    expect(hatched.state.kind).toBe('dino');
    expect(hatched.state.hatched).toBe(true);
  });
});
