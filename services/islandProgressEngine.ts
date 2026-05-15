import { ISLANDS } from './worldCatalog';
import { DifficultyLevel } from '../types';
import { IslandId, IslandProgress, StickerId } from './worldTypes';

export const getIslandByDifficulty = (difficulty?: DifficultyLevel) =>
  ISLANDS.find(island => island.difficulty === difficulty) || null;

export const getIslandById = (islandId: IslandId) =>
  ISLANDS.find(island => island.id === islandId) || null;

export const createInitialIslandProgress = (islandId: IslandId): IslandProgress => ({
  islandId,
  guessedWords: 0,
  unlockedStickerIds: [],
});

export const hasSticker = (progress: IslandProgress, stickerId: StickerId): boolean =>
  progress.unlockedStickerIds.includes(stickerId);

export const applyIslandWordProgress = (
  progress: IslandProgress,
  guessedWordsDelta = 1,
): { progress: IslandProgress; unlockedStickerId: StickerId | null } => {
  const island = getIslandById(progress.islandId);
  if (!island) return { progress, unlockedStickerId: null };

  const nextGuessedWords = Math.max(0, progress.guessedWords + guessedWordsDelta);
  const shouldUnlock = nextGuessedWords >= island.wordsRequiredForSticker && !hasSticker(progress, island.stickerId);
  const unlockedStickerIds = shouldUnlock
    ? [...progress.unlockedStickerIds, island.stickerId]
    : [...progress.unlockedStickerIds];

  return {
    progress: {
      ...progress,
      guessedWords: nextGuessedWords,
      unlockedStickerIds,
    },
    unlockedStickerId: shouldUnlock ? island.stickerId : null,
  };
};
