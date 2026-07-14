export type WordLength = 4 | 5 | 6;
export type DictionarySource = 'builtin' | 'custom' | 'premium';
export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'ALL';
export type SubscriptionTier = 'free' | 'premium';
export type AccountRole = 'admin' | 'user' | 'parent' | 'teacher';
export type AccountMode = 'player' | 'parent' | 'teacher';

export type ViewState = 'landing' | 'profile' | 'setup' | 'game' | 'review' | 'anagrams' | 'translation' | 'sprint' | 'hangman' | 'memory' | 'letter_square' | 'shop' | 'pet_room' | 'account_mode_setup' | 'character_onboarding' | 'family_setup' | 'admin' | 'adult_room' | 'dictionary_settings' | 'dictionary_studio' | 'premium' | 'premium_success';
export type CharStatus = 'correct' | 'present' | 'absent' | 'initial';

export interface FeatureFlags { adultRoom?: boolean; premiumDictionaries?: boolean; dailyWorldReward?: boolean; treatRequests?: boolean; streakStickers?: boolean; levelWardrobe?: boolean; }
export interface WordPerformance { word: string; attempts: number; correct: number; mistakes: number; lastPracticedAt?: string; }
export type WordLearningEventType = 'mistake' | 'resolved' | 'mastered';
export interface WordLearningEvent { at: string; type: WordLearningEventType | string; reviewPriorityAfter: number; }
export interface WordLearningHistory { word: string; firstMistakeAt?: string; lastMistakeAt?: string; lastResolvedAt?: string; mistakeCount: number; resolvedCount: number; currentReviewPriority: number; events: WordLearningEvent[]; }
export interface UserStats { gamesPlayed: number; gamesWon: number; wordsGuessed: Record<string, number>; wordsToReview?: Record<string, any>; wordPerformance?: Record<string, WordPerformance>; wordLearningHistory?: Record<string, WordLearningHistory>; }
export type CharacterMood = 'sad' | 'calm' | 'happy' | 'joyful' | 'super_happy' | 'neutral' | 'excited';
export type CharacterStage = 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
export type InventoryItemType = 'food' | 'pet' | 'accessory' | 'home' | 'mystery' | 'sticker';
export type GameRewardType = 'wordle' | 'sprint' | 'anagram' | 'translation' | 'memory' | 'hangman' | 'letterSquare' | 'letter_square' | 'other';
export type PetWorldId = 'default_room' | 'theatre' | 'amusement_park' | 'ice_rink' | 'opera' | 'sausage_fridge';
export interface PetState { name: string; type: string; level: number; mood: CharacterMood; xp: number; moodScore?: number; stage?: CharacterStage; characterOnboarded?: boolean; hunger?: number; energy?: number; equippedAccessories: string[]; activeHomeItemId?: string; activeWorldId?: PetWorldId; activeWorldDate?: string; dailyStreak?: number; lastDailyActivityDate?: string; earnedStickerIds?: string[]; requestedTreatId?: string; }
export interface InventoryItem { id: string; type: InventoryItemType; name: string; quantity: number; metadata?: { imageUrl?: string; minLevel?: number; temporary?: boolean; }; }
export interface ManagedLearner { id: string; name: string; classLabel?: string; childShareCode?: string; stats: UserStats; assignedWords: string[]; weeklyAccuracy: number; lastActiveAt?: string; }
export interface CustomDictionaryCollection { id: string; title: string; source: 'manual' | 'ocr' | 'class' | 'topic'; words: string[]; classLabel?: string; theme?: string; createdAt?: string; }
export interface UserProfile { username: string; role?: AccountRole; accountMode?: AccountMode; subscriptionTier?: SubscriptionTier; premiumExpiresAt?: string; childDisplayName?: string; childShareCode?: string; childSlotsLimit?: number; featureFlags?: FeatureFlags; customDictionaryEn: string[]; assignedWords?: string[]; dictionaryCollections?: CustomDictionaryCollection[]; managedLearners?: ManagedLearner[]; weeklyReportEmail?: string; stats: UserStats; pet: PetState; coins: number; inventory: InventoryItem[]; }
export type DailyQuestKind = 'wordle_four' | 'sprint_twelve' | 'memory_sixteen' | 'hangman_clean' | 'all_five_games';
export interface DailyQuestState { questDate: string; kind: DailyQuestKind; title: string; description: string; progressLabel: string; completed: boolean; completedAt?: string | null; rewardItemId?: string | null; rewardWorldId?: PetWorldId | null; }
export interface DailyQuestCompletionReward { quest: DailyQuestState; item?: ShopItem | null; worldId?: PetWorldId | null; }
export interface ShopRandomRewardOption { itemId: string; weight: number; }
export interface ShopItem { id: string; name: string; price: number; type: InventoryItemType; minLevel: number; description: string; imageUrl?: string; effect?: { mood?: number; moodCap?: number; }; characterType?: string; randomReward?: { pool: ShopRandomRewardOption[]; }; }
export interface CellData { letter: string; status: CharStatus; }
export interface GameSettings { wordLength: WordLength; useCustomDictionary: boolean; dictionarySource: DictionarySource; difficulty: DifficultyLevel; username: string; activePremiumDictionaryId?: string; }
export interface EnrichedWord { word: string; translation: string; level: string; isTransliterated?: boolean; }
export interface HistoryItem { word: string; translation: string | null; }
export interface GameState { secretWord: string; secretWordData?: EnrichedWord | null; guesses: string[]; history: HistoryItem[]; currentGuess: string; gameStatus: 'playing' | 'won' | 'lost'; rowIndex: number; hint: string | null; loadingHint: boolean; hintCoinsSpent?: number; error: string | null; }
export interface KeyboardKey { key: string; status?: CharStatus; }