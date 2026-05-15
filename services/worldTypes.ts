import { DifficultyLevel } from '../types';

export type GameMode = 'classic' | 'anagrams' | 'sprint' | 'memory' | 'hangman';

export type PetKind = 'egg' | 'owl' | 'fox' | 'dino';
export type PetPersonality = 'smart' | 'tricky' | 'strong' | 'mystery';
export type PetStage = 'egg' | 'baby' | 'teen' | 'master';

export interface PetArchetype {
  id: PetKind;
  displayName: string;
  personality: PetPersonality;
  starter: boolean;
}

export interface PetProgressState {
  kind: PetKind;
  level: number;
  guessedWordsSinceRegistration: number;
  hatched: boolean;
}

export type IslandId = 'forest_a1' | 'jungle_a2' | 'mountain_b1';
export type StickerId = 'forest_a1_sticker' | 'jungle_a2_sticker' | 'mountain_b1_sticker';

export interface IslandDefinition {
  id: IslandId;
  title: string;
  difficulty: DifficultyLevel;
  stickerId: StickerId;
  wordsRequiredForSticker: number;
}

export interface IslandProgress {
  islandId: IslandId;
  guessedWords: number;
  unlockedStickerIds: StickerId[];
}

export type GameEvent =
  | { type: 'WORD_GUESSED'; word: string; wordLength: number; mode: GameMode; difficulty?: DifficultyLevel }
  | { type: 'GAME_WON'; mode: GameMode; difficulty?: DifficultyLevel }
  | { type: 'GAME_LOST'; mode: GameMode; difficulty?: DifficultyLevel }
  | { type: 'PET_TAPPED' }
  | { type: 'ITEM_PURCHASED'; itemId: string }
  | { type: 'ITEM_USED'; itemId: string };

export type PetReactionType = 'heart' | 'phrase' | 'sound';
export type PetReactionIntensity = 'small' | 'medium' | 'big';

export interface PetReaction {
  type: PetReactionType;
  intensity?: PetReactionIntensity;
  text?: string;
  soundId?: string;
}

export interface ProgressionEvent {
  type: 'EGG_READY_TO_HATCH' | 'PET_HATCHED' | 'STICKER_UNLOCKED';
  petKind?: Exclude<PetKind, 'egg'>;
  islandId?: IslandId;
  stickerId?: StickerId;
}

export interface RewardOutcome {
  coinsDelta: number;
  xpDelta: number;
  petReaction?: PetReaction;
  progressionEvent?: ProgressionEvent;
}
