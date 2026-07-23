import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCustomWordsAvailableInBuiltinDictionary, hasRussianTranslation, isAllowedSecretWord, isAllowedValidationWord, toCustomEnrichedWords } from '../services/dictionaryEngine';
import { ensureDictionaryRuntime, readGeneralDictionary, readPremiumDictionary, resolvePremiumDictionaryId, type PremiumDictionaryWord } from '../services/dictionaryRuntime';
import { getAllKidsDictionaryWords, getFreeKidsDictionaryEntries, getKidsPremiumDictionaryEntries, getKidsPremiumDictionaryWords } from '../services/kidsDictionaryCatalog';
import { isKidsMode } from '../services/modeFlags';
import { hasPremiumDictionaryAccess } from '../services/premiumDictionaryCatalog';
import { normalizeWord } from '../services/wordNormalization';
import { DifficultyLevel, EnrichedWord, GameSettings, UserProfile, WordLength } from '../types';

interface UseDictionaryPoolsArgs {
  settings: GameSettings;
  userProfile: UserProfile;
  enabled?: boolean;
}

type ModeWordPoolOptions = {
  respectWordLength?: boolean;
};

export type DictionaryRuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

type LoadState = {
  key: string;
  status: DictionaryRuntimeStatus;
  error: string | null;
};

const VALID_PREMIUM_LEVELS = new Set<Exclude<DifficultyLevel, 'ALL'>>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const PREMIUM_WORD_PATTERN = /^[A-Z]{4,18}$/;
const DICTIONARY_ROUTE_PATTERN = /^\/play\/(setup|classic|anagrams|one-of-two|sprint|hangman|memory|snake)\/?$/;
const shouldLoadForCurrentRoute = (): boolean => typeof window !== 'undefined' && DICTIONARY_ROUTE_PATTERN.test(window.location.pathname);

const normalizePremiumEntry = (item: PremiumDictionaryWord, builtinTranslationByWord: Map<string, string>): EnrichedWord | null => {
  const rawWord = typeof item === 'string' ? item : item.word;
  const word = normalizeWord(rawWord || '');
  if (!PREMIUM_WORD_PATTERN.test(word)) return null;
  const level = typeof item === 'string' ? null : VALID_PREMIUM_LEVELS.has(item.level) ? item.level : null;
  if (!level) return null;
  const directTranslation = typeof item === 'string' ? null : item.translation?.trim();
  return {
    word,
    level,
    translation: directTranslation || builtinTranslationByWord.get(word)?.trim() || word,
  };
};

const getLoadedPremiumEntries = (id?: string, difficulty: DifficultyLevel = 'ALL'): EnrichedWord[] => {
  const general = readGeneralDictionary();
  const file = readPremiumDictionary(id);
  if (!general || !file) return [];
  const builtinTranslationByWord = new Map(general.COMMON_WORDS_EN.map(entry => [normalizeWord(entry.word), entry.translation]));
  const seen = new Set<string>();
  const entries: EnrichedWord[] = [];
  for (const item of file.words) {
    const entry = normalizePremiumEntry(item, builtinTranslationByWord);
    if (!entry || seen.has(entry.word) || (difficulty !== 'ALL' && entry.level !== difficulty)) continue;
    seen.add(entry.word);
    entries.push(entry);
  }
  return entries;
};

export const useDictionaryPools = ({ settings, userProfile, enabled }: UseDictionaryPoolsArgs) => {
  const runtimeEnabled = enabled ?? shouldLoadForCurrentRoute();
  const kidsMode = isKidsMode(userProfile);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const premiumDictionaryId = !kidsMode && settings.dictionarySource === 'premium' && hasPremium
    ? resolvePremiumDictionaryId(settings.activePremiumDictionaryId)
    : null;
  const loadKey = runtimeEnabled ? `general:${premiumDictionaryId || 'none'}` : 'disabled';
  const [loadState, setLoadState] = useState<LoadState>({ key: 'disabled', status: 'idle', error: null });

  const ensureReady = useCallback(async (): Promise<void> => {
    if (!runtimeEnabled) return;
    setLoadState(previous => previous.key === loadKey && previous.status === 'ready'
      ? previous
      : { key: loadKey, status: 'loading', error: null });
    try {
      await ensureDictionaryRuntime(premiumDictionaryId);
      setLoadState({ key: loadKey, status: 'ready', error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить словарь.';
      setLoadState({ key: loadKey, status: 'error', error: message });
      throw error;
    }
  }, [loadKey, premiumDictionaryId, runtimeEnabled]);

  useEffect(() => {
    if (!runtimeEnabled) {
      setLoadState({ key: 'disabled', status: 'idle', error: null });
      return;
    }
    void ensureReady().catch(() => undefined);
  }, [ensureReady, runtimeEnabled]);

  const status: DictionaryRuntimeStatus = !runtimeEnabled
    ? 'idle'
    : loadState.key === loadKey
      ? loadState.status
      : 'loading';
  const error = loadState.key === loadKey ? loadState.error : null;

  const getSecretWordPool = useCallback((): EnrichedWord[] => {
    let pool: EnrichedWord[] = [];
    const currentKidsMode = isKidsMode(userProfile);
    const currentHasPremium = hasPremiumDictionaryAccess(userProfile);
    const assignedWords = userProfile.assignedWords || [];
    const isPracticeCustomDictionary = !currentKidsMode && settings.dictionarySource === 'custom';

    if (currentKidsMode) {
      if (settings.dictionarySource === 'premium' && currentHasPremium) {
        pool = getKidsPremiumDictionaryEntries(settings.activePremiumDictionaryId, settings.difficulty);
      } else if (settings.dictionarySource === 'custom' && currentHasPremium) {
        pool = toCustomEnrichedWords(userProfile.customDictionaryEn);
      } else if (assignedWords.length > 0 && currentHasPremium) {
        pool = toCustomEnrichedWords(assignedWords);
      } else {
        pool = getFreeKidsDictionaryEntries(settings.difficulty);
      }
    } else if (settings.dictionarySource === 'premium' && currentHasPremium) {
      pool = getLoadedPremiumEntries(settings.activePremiumDictionaryId, settings.difficulty);
    } else if (settings.dictionarySource === 'custom') {
      pool = toCustomEnrichedWords(userProfile.customDictionaryEn);
    } else {
      pool = (readGeneralDictionary()?.COMMON_WORDS_EN || []).filter(word => hasRussianTranslation(word.translation));
      if (settings.difficulty !== 'ALL') {
        pool = pool.filter(word => word.level === settings.difficulty);
      }
      pool = pool.map(word => ({ ...word, word: word.word.toUpperCase() }));
    }

    return pool.filter(word => isPracticeCustomDictionary ? isAllowedValidationWord(word.word) : isAllowedSecretWord(word.word));
  }, [settings.activePremiumDictionaryId, settings.dictionarySource, settings.difficulty, userProfile]);

  const getValidationPool = useCallback((wordLengthOverride?: WordLength): string[] => {
    const validationWordLength = wordLengthOverride ?? settings.wordLength;
    const currentKidsMode = isKidsMode(userProfile);
    const currentHasPremium = hasPremiumDictionaryAccess(userProfile);
    const premiumWords = currentKidsMode
      ? (currentHasPremium ? getKidsPremiumDictionaryWords(settings.activePremiumDictionaryId, settings.difficulty) : [])
      : (settings.dictionarySource === 'premium' && currentHasPremium ? getLoadedPremiumEntries(settings.activePremiumDictionaryId, settings.difficulty).map(entry => entry.word) : []);
    const kidsWords = currentKidsMode ? getAllKidsDictionaryWords() : [];
    const customWords = getCustomWordsAvailableInBuiltinDictionary(userProfile.customDictionaryEn || []);
    const assignedWords = getCustomWordsAvailableInBuiltinDictionary(userProfile.assignedWords || []);
    const combinedPool = [
      ...(readGeneralDictionary()?.ALL_WORDS_EN || []),
      ...kidsWords,
      ...premiumWords,
      ...customWords,
      ...assignedWords,
    ]
      .filter(word => word.length === validationWordLength)
      .map(word => word.toUpperCase())
      .filter(word => isAllowedValidationWord(word));

    return Array.from(new Set(combinedPool));
  }, [settings.activePremiumDictionaryId, settings.dictionarySource, settings.difficulty, settings.wordLength, userProfile]);

  const getModeWords = useCallback((options: ModeWordPoolOptions = {}): string[] => {
    const secretPool = getSecretWordPool();
    const filteredPool = options.respectWordLength
      ? secretPool.filter(entry => entry.word.length === settings.wordLength)
      : secretPool;

    return filteredPool.map(entry => entry.word);
  }, [getSecretWordPool, settings.wordLength]);

  const getWordTranslation = useCallback((word: string): string | null => {
    const normalized = normalizeWord(word);
    if (!normalized) return null;
    const generalEntry = readGeneralDictionary()?.COMMON_WORDS_EN.find(entry => normalizeWord(entry.word) === normalized);
    if (generalEntry?.translation) return generalEntry.translation;
    const premiumEntry = getLoadedPremiumEntries(settings.activePremiumDictionaryId, 'ALL').find(entry => entry.word === normalized);
    return premiumEntry?.translation || null;
  }, [settings.activePremiumDictionaryId]);

  return useMemo(() => ({
    status,
    error,
    ensureReady,
    getSecretWordPool,
    getValidationPool,
    getModeWords,
    getWordTranslation,
  }), [ensureReady, error, getModeWords, getSecretWordPool, getValidationPool, getWordTranslation, status]);
};
