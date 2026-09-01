import type { EnrichedWord } from '../types';
import { getKidsDictionaryCatalog, getKidsPremiumDictionaryEntries, type KidsDictionaryId } from './kidsDictionaryCatalog';
import { ensurePremiumDictionaryLoaded, type PremiumDictionaryWord } from './dictionaryRuntime';
import { getPremiumDictionaryCatalog, type PremiumDictionaryId } from './premiumDictionaryCatalog';
import {
  ensureSpotlightDictionaryLoaded,
  getSpotlightEntries,
  getSpotlightGrades,
  getSpotlightSections,
  SPOTLIGHT_ALL_SECTIONS_ID,
  type SpotlightGradeNumber,
} from './spotlightDictionary';

type StandardPremiumDictionaryId = Exclude<PremiumDictionaryId, 'premium_spotlight_school'>;

export type DictionaryImportWord = { word: string; translation?: string };

export type DictionaryImportSource =
  | { id: 'spotlight'; title: string; kind: 'spotlight' }
  | { id: `kids:${KidsDictionaryId}`; title: string; kind: 'kids'; dictionaryId: KidsDictionaryId }
  | { id: `premium:${Exclude<PremiumDictionaryId, 'premium_spotlight_school'>}`; title: string; kind: 'premium'; dictionaryId: Exclude<PremiumDictionaryId, 'premium_spotlight_school'> };

const normalizeWords = (entries: Array<EnrichedWord | PremiumDictionaryWord>): DictionaryImportWord[] => {
  const words = new Map<string, string | undefined>();
  for (const entry of entries) {
    const word = String(typeof entry === 'string' ? entry : entry.word || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z'-]{1,}$/.test(word) || words.has(word)) continue;
    const translation = typeof entry === 'string' ? undefined : entry.translation?.trim() || undefined;
    words.set(word, translation);
  }
  return Array.from(words, ([word, translation]) => ({ word, translation }));
};

export const getDictionaryImportSources = (kidsMode: boolean): DictionaryImportSource[] => {
  const spotlight: DictionaryImportSource = { id: 'spotlight', title: 'Школьные (Spotlight)', kind: 'spotlight' };
  if (kidsMode) {
    return [
      spotlight,
      ...getKidsDictionaryCatalog().map(item => ({
        id: `kids:${item.id}` as const,
        title: item.title,
        kind: 'kids' as const,
        dictionaryId: item.id,
      })),
    ];
  }

  return [
    spotlight,
    ...getPremiumDictionaryCatalog()
      .filter(item => item.id !== 'premium_spotlight_school')
      .map(item => {
        const dictionaryId = item.id as StandardPremiumDictionaryId;
        return {
          id: `premium:${dictionaryId}` as `premium:${StandardPremiumDictionaryId}`,
          title: item.title,
          kind: 'premium' as const,
          dictionaryId,
        };
      }),
  ];
};

export const loadDictionaryImportWords = async (
  source: DictionaryImportSource,
  spotlightGrade: SpotlightGradeNumber = 2,
  spotlightSectionId = SPOTLIGHT_ALL_SECTIONS_ID,
): Promise<DictionaryImportWord[]> => {
  if (source.kind === 'kids') return normalizeWords(getKidsPremiumDictionaryEntries(source.dictionaryId));
  if (source.kind === 'premium') {
    const dictionary = await ensurePremiumDictionaryLoaded(source.dictionaryId);
    return normalizeWords(dictionary.words);
  }
  await ensureSpotlightDictionaryLoaded();
  return normalizeWords(getSpotlightEntries(spotlightGrade, spotlightSectionId));
};

export const loadSpotlightImportOptions = async (grade: SpotlightGradeNumber) => {
  await ensureSpotlightDictionaryLoaded();
  return {
    grades: getSpotlightGrades(),
    sections: getSpotlightSections(grade),
  };
};

export const mergeImportedDictionaryWords = (currentWords: string[], selectedWords: string[]): string[] =>
  Array.from(new Set([...currentWords, ...selectedWords].map(word => word.trim().toUpperCase()).filter(Boolean)));

export const mergeImportedDictionaryTranslations = (
  currentTranslations: Record<string, string>,
  entries: DictionaryImportWord[],
  selectedWords: string[],
): Record<string, string> => {
  const selected = new Set(selectedWords);
  const merged = { ...currentTranslations };
  for (const entry of entries) {
    if (!selected.has(entry.word) || !entry.translation || merged[entry.word]) continue;
    merged[entry.word] = entry.translation;
  }
  return merged;
};
