export type WordLength = 4 | 5 | 6;
export type DictionarySource = 'builtin' | 'custom';
export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'ALL';

export type ViewState = 'landing' | 'profile' | 'setup' | 'game' | 'review' | 'anagrams' | 'sprint' | 'hangman' | 'memory' | 'shop' | 'pet_room' | 'admin';

export type CharStatus = 'correct' | 'present' | 'absent' | 'initial';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  wordsGuessed: Record<string, number>; // Word -> count of times guessed correctly
}

// --- NEW: Word Jail & Pet Types ---

export interface PetState {
  name: string;
  type: string; // 'Owl', 'Cat', 'Dragon', etc.
  level: number;
  mood: 'sad' | 'neutral' | 'happy' | 'excited';
  xp: number;
  hunger: number; // 0-100
  energy: number; // 0-100
  equippedAccessories: string[]; // IDs of equipped items
}

export interface InventoryItem {
  id: string;
  type: 'food' | 'pet' | 'accessory';
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
  type: 'food' | 'pet' | 'accessory';
  minLevel: number;
  description: string;
  imageUrl?: string;
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