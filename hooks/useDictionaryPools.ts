import { useCallback } from 'react';
import { ALL_WORDS_EN, COMMON_WORDS_EN } from '../dictionaries/mainEnglish';
import { hasRussianTranslation, toCustomEnrichedWords } from '../services/dictionaryEngine';
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
      pool = toCustomEnrichedWords(userProfile.customDictionaryEn);
    } else {
      pool = COMMON_WORDS_EN.filter(word => hasRussianTranslation(word.translation));
      if (settings.difficulty !== 'ALL') {
        pool = pool.filter(word => word.level === settings.difficulty);
      }
      pool = pool.map(word => ({ ...word, word: word.word.toUpperCase() }));
    }

    return pool.filter(word => !word.word.endsWith('S') || word.word.endsWith('SS'));
  }, [settings.dictionarySource, settings.difficulty, userProfile.customDictionaryEn]);

  const getValidationPool = useCallback((): string[] => {
    const combinedPool = ALL_WORDS_EN
      .filter(word => word.length === settings.wordLength)
      .map(word => word.toUpperCase());

    return Array.from(new Set(combinedPool));
  }, [settings.wordLength]);

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
