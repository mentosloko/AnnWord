import { GameSettings, UserProfile, EnrichedWord } from '../types';
import {
  buildDictionaryPools,
  getDictionaryEmptyStateMessage,
  getTranslationForWord,
  pickRandomSecretWord,
} from './dictionaryEngine';

export interface GameDictionaryContext {
  settings: Pick<GameSettings, 'wordLength' | 'dictionarySource' | 'difficulty'>;
  userProfile: Pick<UserProfile, 'customDictionaryEn'>;
}

export interface PreparedGameDictionary {
  secretWordPool: EnrichedWord[];
  validationPool: string[];
  errorMessage: string | null;
  dictionarySourceUsed: 'builtin' | 'custom';
}

export const prepareGameDictionary = ({ settings, userProfile }: GameDictionaryContext): PreparedGameDictionary => {
  const pools = buildDictionaryPools({
    source: settings.dictionarySource,
    wordLength: settings.wordLength,
    difficulty: settings.difficulty,
    customDictionaryEn: userProfile.customDictionaryEn,
  });

  return {
    secretWordPool: pools.secretWordPool,
    validationPool: pools.validationPool,
    errorMessage: pools.secretWordPool.length === 0
      ? getDictionaryEmptyStateMessage({
          source: settings.dictionarySource,
          wordLength: settings.wordLength,
          difficulty: settings.difficulty,
          customDictionaryEn: userProfile.customDictionaryEn,
        })
      : null,
    dictionarySourceUsed: pools.dictionarySourceUsed,
  };
};

export const pickSecretForGame = (dictionary: PreparedGameDictionary, random?: () => number): EnrichedWord | null =>
  pickRandomSecretWord(dictionary.secretWordPool, random);

export const isValidGuessForGame = (guess: string, dictionary: Pick<PreparedGameDictionary, 'validationPool'>): boolean =>
  dictionary.validationPool.includes(guess.trim().toUpperCase());

export const getGuessTranslationForGame = (guess: string): string | null =>
  getTranslationForWord(guess);

export const getHintPoolForGame = (dictionary: Pick<PreparedGameDictionary, 'secretWordPool'>): string[] =>
  dictionary.secretWordPool.map(item => item.word);
