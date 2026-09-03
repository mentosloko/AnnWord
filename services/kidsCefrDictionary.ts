import type { EnrichedWord } from '../types';
import { isAllowedSecretWord } from './dictionaryEngine';
import { hasRussianTranslation, normalizeWord } from './wordNormalization';

// The general CEFR dictionary is used in Kids mode. The shared blacklist handles
// profanity and explicit vocabulary; these terms are additionally unsuitable as
// children’s game prompts.
const KIDS_CONTENT_EXCLUSIONS = new Set<string>([
  'BEER', 'BOMB', 'BOMBER', 'CASINO', 'GAMBLE', 'GUNMAN', 'GUNNER',
  'KILL', 'KILLER', 'MURDER', 'POKER', 'RIFLE', 'SMOKE', 'VODKA',
  'WHISKY', 'WINE', 'WINERY',
]);

export const getKidsCefrEntries = (entries: EnrichedWord[]): EnrichedWord[] => {
  const seen = new Set<string>();

  return entries.reduce<EnrichedWord[]>((result, entry) => {
    const word = normalizeWord(entry.word);
    if (
      !word
      || seen.has(word)
      || !hasRussianTranslation(entry.translation)
      || !isAllowedSecretWord(word)
      || KIDS_CONTENT_EXCLUSIONS.has(word)
    ) return result;

    seen.add(word);
    result.push({ ...entry, word });
    return result;
  }, []);
};
