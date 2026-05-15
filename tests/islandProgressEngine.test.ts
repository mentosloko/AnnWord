import { describe, expect, it } from 'vitest';
import { applyIslandWordProgress, createInitialIslandProgress, getIslandByDifficulty, getIslandById } from '../services/islandProgressEngine';

describe('islandProgressEngine', () => {
  it('maps difficulties to island definitions', () => {
    expect(getIslandByDifficulty('A1')?.id).toBe('forest_a1');
    expect(getIslandByDifficulty('A2')?.id).toBe('jungle_a2');
    expect(getIslandByDifficulty('B1')?.id).toBe('mountain_b1');
    expect(getIslandByDifficulty('ALL')).toBeNull();
  });

  it('creates initial island progress', () => {
    expect(createInitialIslandProgress('forest_a1')).toEqual({
      islandId: 'forest_a1',
      guessedWords: 0,
      unlockedStickerIds: [],
    });
  });

  it('unlocks sticker exactly when threshold is reached', () => {
    const island = getIslandById('forest_a1')!;
    const progress = createInitialIslandProgress('forest_a1');

    const before = applyIslandWordProgress(progress, island.wordsRequiredForSticker - 1);
    expect(before.progress.guessedWords).toBe(9);
    expect(before.unlockedStickerId).toBeNull();
    expect(before.progress.unlockedStickerIds).toEqual([]);

    const unlocked = applyIslandWordProgress(before.progress, 1);
    expect(unlocked.progress.guessedWords).toBe(10);
    expect(unlocked.unlockedStickerId).toBe('forest_a1_sticker');
    expect(unlocked.progress.unlockedStickerIds).toEqual(['forest_a1_sticker']);
  });

  it('does not duplicate unlocked stickers', () => {
    const alreadyUnlocked = {
      islandId: 'forest_a1' as const,
      guessedWords: 10,
      unlockedStickerIds: ['forest_a1_sticker' as const],
    };

    const result = applyIslandWordProgress(alreadyUnlocked, 5);
    expect(result.unlockedStickerId).toBeNull();
    expect(result.progress.unlockedStickerIds).toEqual(['forest_a1_sticker']);
  });
});
