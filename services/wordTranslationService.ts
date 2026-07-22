import { getTranslationForWord, normalizeWord } from './dictionaryEngine';
import { ensureGeneralDictionaryLoaded, ensurePremiumDictionaryLoaded } from './dictionaryRuntime';
import { getPremiumDictionaryCatalog } from './premiumDictionaryCatalog';

const translationCache = new Map<string, string | null>();

export const wordTranslationService = {
  async get(word: string): Promise<string | null> {
    const normalized = normalizeWord(word);
    if (!normalized) return null;
    if (translationCache.has(normalized)) return translationCache.get(normalized) ?? null;

    await ensureGeneralDictionaryLoaded();
    const builtinTranslation = getTranslationForWord(normalized);
    if (builtinTranslation) {
      translationCache.set(normalized, builtinTranslation);
      return builtinTranslation;
    }

    for (const dictionary of getPremiumDictionaryCatalog()) {
      const file = await ensurePremiumDictionaryLoaded(dictionary.id);
      const match = file.words.find(entry => typeof entry !== 'string' && normalizeWord(entry.word) === normalized);
      if (match && typeof match !== 'string' && match.translation) {
        translationCache.set(normalized, match.translation);
        return match.translation;
      }
    }

    translationCache.set(normalized, null);
    return null;
  },
};
