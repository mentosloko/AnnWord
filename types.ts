export type WordLength = 4 | 5 | 6;
export type DictionarySource = 'builtin' | 'custom';
export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'ALL';

export type ViewState = 'landing' | 'profile' | 'setup' | 'game' | 'review' | 'anagrams' | 'sprint' | 'hangman' | 'memory' | 'shop' | 'pet_room' | 'character_onboarding' | 'admin';

export type CharStatus = 'correct' | 'present' | 'absent' | 'initial';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  wordsGuessed: Record<string, number>; // Word -> count of times guessed correctly
}

// --- Character gamification types ---

export type CharacterMood = 'sad' | 'calm' | 'happy' | 'joyful' | 'super_happy' | 'neutral' | 'excited';
export type CharacterStage = 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
export type InventoryItemType = 'food' | 'pet' | 'accessory' | 'home';
export type GameRewardType = 'wordle' | 'sprint' | 'anagram' | 'memory' | 'hangman' | 'other';

export interface PetState {
  name: string;
  type: string; // 'Puppy', 'Dragon', 'RoboCat', etc. Kept as PetState for backward compatibility.
  level: number;
  mood: CharacterMood;
  xp: number; // Total character XP, not level-local XP.
  moodScore?: number; // 0-100. Games can raise it to 70; treats can raise it to 100.
  stage?: CharacterStage;
  characterOnboarded?: boolean;
  hunger?: number; // Legacy field. Do not use for new reward logic.
  energy?: number; // Legacy field. Do not use for new reward logic.
  equippedAccessories: string[]; // IDs of equipped items
  activeHomeItemId?: string;
}

export interface InventoryItem {
  id: string;
  type: InventoryItemType;
  name: string;
  quantity: number;
  metadata?: { imageUrl?: string }; // FIX: было any, уточнили тип
}

export interface UserProfile {
  username: string;
  role?: 'admin' | 'user';
  customDictionaryEn: string[];
  stats: UserStats;
  pet: PetState;
  coins: number;
  inventory: InventoryItem[];
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: InventoryItemType;
  minLevel: number;
  description: string;
  imageUrl?: string;
  effect?: {
    mood?: number;
    moodCap?: number;
  };
  characterType?: string;
}

// ----------------------------------

export interface CellData {
  letter: string;
  status: CharStatus;
}

export interface GameSettings {
  wordLength: WordLength;
  useCustomDictionary: boolean; // Kept for backward compat logic, but dictionarySource is main now
  dictionarySource: DictionarySource;
  difficulty: DifficultyLevel;
  username: string; // Current active user
}

// New interface for words with metadata
export interface EnrichedWord {
  word: string;
  translation: string;
  level: string; // e.g., 'A1', 'B2'
}

export interface HistoryItem {
  word: string;
  translation: string | null;
}

export interface GameState {
  secretWord: string;
  secretWordData?: EnrichedWord | null; // Store metadata for the UI
  guesses: string[]; // List of words guessed so far
  history: HistoryItem[]; // List of guesses with translations
  currentGuess: string; // Current input being typed
  gameStatus: 'playing' | 'won' | 'lost';
  rowIndex: number;
  hint: string | null;
  loadingHint: boolean;
  error: string | null;
}

export interface KeyboardKey {
  key: string;
  status?: CharStatus;
}