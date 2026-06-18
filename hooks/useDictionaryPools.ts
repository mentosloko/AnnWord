import { useCallback } from 'react';
import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../dictionaries/mainEnglish';
import { hasRussianTranslation, isAllowedSecretWord, isAllowedValidationWord, toCustomEnrichedWords } from '../services/dictionaryEngine';
import { isKidsMode } from '../services/modeFlags';
import { getPremiumDictionaryEntries, getPremiumDictionaryWords, hasPremiumDictionaryAccess } from '../services/premiumDictionaryCatalog';
import { EnrichedWord, GameSettings, UserProfile } from '../types';

interface UseDictionaryPoolsArgs {
  settings: GameSettings;
  userProfile: UserProfile;
}

type ModeWordPoolOptions = {
  respectWordLength?: boolean;
};

export const useDictionaryPools = ({ settings, userProfile }: UseDictionaryPoolsArgs) => {
  const getSecretWordPool = useCallback((): EnrichedWord[] => {
    let pool: EnrichedWord[] = [];
    const kidsMode = isKidsMode(userProfile);
    const canUsePremiumDictionary = !kidsMode && settings.dictionarySource === 'premium' && hasPremiumDictionaryAccess(userProfile);

    if (canUsePremiumDictionary) {
      pool = getPremiumDictionaryEntries(settings.activePremiumDictionaryId, settings.difficulty);
    } else if (settings.dictionarySource === 'custom') {
      pool = toCustomEnrichedWords(userProfile.customDictionaryEn);
    } else {
      pool = COMMON_WORDS_EN.filter(word => hasRussianTranslation(word.translation));
      if (settings.difficulty !== 'ALL') {
        pool = pool.filter(word => word.level === settings.difficulty);
      }
      pool = pool.map(word => ({ ...word, word: word.word.toUpperCase() }));
    }

    return pool.filter(word => isAllowedSecretWord(word.word));
  }, [settings.activePremiumDictionaryId, settings.dictionarySource, settings.difficulty, userProfile]);

  const getValidationPool = useCallback((): string[] => {
    const kidsMode = isKidsMode(userProfile);
    const premiumWords = !kidsMode && settings.dictionarySource === 'premium' && hasPremiumDictionaryAccess(userProfile)
      ? getPremiumDictionaryWords(settings.activePremiumDictionaryId, settings.difficulty)
      : [];
    const combinedPool = [
      ...ALL_WORDS_EN,
      ...premiumWords,
    ]
      .filter(word => word.length === settings.wordLength)
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

  return {
    getSecretWordPool,
    getValidationPool,
    getModeWords,
  };
};
