import { useCallback } from 'react';
import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../dictionaries/english';
import { getCustomWordsAvailableInBuiltinDictionary } from '../services/dictionaryEngine';
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

    if (settings.dictionarySource === 'custom') {
      pool = getCustomWordsAvailableInBuiltinDictionary(userProfile.customDictionaryEn).map(word => ({
        word,
        translation: '',
        level: 'Custom',
      }));
    } else {
      pool = COMMON_WORDS_EN;
      if (settings.difficulty !== 'ALL') {
        pool = pool.filter(word => word.level === settings.difficulty);
      }
      pool = pool.map(word => ({ ...word, word: word.word.toUpperCase() }));
    }

    return pool.filter(word => !word.word.endsWith('S') || word.word.endsWith('SS'));
  }, [settings.dictionarySource, settings.difficulty, userProfile.customDictionaryEn]);

  const getValidationPool = useCallback((): string[] => {
    let combinedPool = ALL_WORDS_EN
      .filter(word => word.length === settings.wordLength)
      .map(word => word.toUpperCase());

    if (userProfile.customDictionaryEn.length > 0) {
      const customFiltered = getCustomWordsAvailableInBuiltinDictionary(userProfile.customDictionaryEn)
        .filter(word => word.length === settings.wordLength);
      combinedPool = [...combinedPool, ...customFiltered];
    }

    return Array.from(new Set(combinedPool));
  }, [settings.wordLength, userProfile.customDictionaryEn]);

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