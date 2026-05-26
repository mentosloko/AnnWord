import { EnrichedWord } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';

export const getWordsMissingTranslations = (
  words: string[] = [],
  fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN,
): string[] => {
  const translatedWords = new Set(
    fallbackDictionary
      .filter(entry => Boolean(entry.word && entry.translation))
      .map(entry => entry.word.trim().toUpperCase()),
  );

  return Array.from(new Set(
    words
      .map(word => word.trim().toUpperCase())
      .filter(Boolean)
      .filter(word => !translatedWords.has(word)),
  )).sort((first, second) => first.localeCompare(second));
};
