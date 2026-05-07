export type WordLength = 4 | 5 | 6;
export type DictionarySource = 'builtin' | 'custom';
export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'ALL';

export type ViewState = 'landing' | 'profile' | 'setup' | 'game' | 'review' | 'anagrams' | 'sprint' | 'hangman' | 'memory' | 'shop' | 'pet_room' | 'admin';

export type CharStatus = 'correct' | 'present' | 'absent' | 'initial';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  wordsGuessed: Record<string, number>;
}

export interface PetState {
  name: string;
  type: string;
  level: number;
  mood: 'sad' | 'neutral' | 'happy' | 'excited';
  xp: number;
  hunger: number;
  energy: number;
  equippedAccessories: string[];
}

/** Typed metadata — no more `any` */
export interface InventoryItemMetadata {
  imageUrl?: string;
}

export interface InventoryItem {
  id: string;
  type: 'food' | 'pet' | 'accessory';
  name: string;
  quantity: number;
  metadata?: InventoryItemMetadata;
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

export interface CellData {
  letter: string;
  status: CharStatus;
}

export interface GameSettings {
  wordLength: WordLength;
  useCustomDictionary: boolean;
  dictionarySource: DictionarySource;
  difficulty: DifficultyLevel;
  username: string;
}

export interface EnrichedWord {
  word: string;
  translation: string;
  level: string;
}

export interface HistoryItem {
  word: string;
  translation: string | null;
}

export interface GameState {
  secretWord: string;
  secretWordData?: EnrichedWord | null;
  guesses: string[];
  history: HistoryItem[];
  currentGuess: string;
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