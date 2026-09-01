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

const isStandardPremiumDictionary = (
  item: PremiumDictionaryMeta,
): item is PremiumDictionaryMeta & { id: StandardPremiumDictionaryId } =>
  item.id !== 'premium_spotlight_school';

export type DictionaryImportSource =
  | { id: 'spotlight'; title: string; kind: 'spotlight' }
  | { id: `kids:${KidsDictionaryId}`; title: string; kind: 'kids'; dictionaryId: KidsDictionaryId }
  | { id: `premium:${Exclude<PremiumDictionaryId, 'premium_spotlight_school'>}`; title: string; kind: 'premium'; dictionaryId: Exclude<PremiumDictionaryId, 'premium_spotlight_school'> };

const normalizeWords = (entries: Array<EnrichedWord | PremiumDictionaryWord>): string[] => Array.from(new Set(entries
  .map(entry => typeof entry === 'string' ? entry : entry.word)
  .map(word => String(word || '').trim().toUpperCase())
  .filter(word => /^[A-Z][A-Z'-]{1,}$/.test(word)),
));

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
      .map(item => ({
        id: `premium:${item.id}` as const,
        title: item.title,
        kind: 'premium' as const,
        dictionaryId: item.id,
      })),
  ];
};

export const loadDictionaryImportWords = async (
  source: DictionaryImportSource,
  spotlightGrade: SpotlightGradeNumber = 2,
  spotlightSectionId = SPOTLIGHT_ALL_SECTIONS_ID,
): Promise<string[]> => {
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
