import type { EnrichedWord } from '../types';

export const SPOTLIGHT_PREMIUM_DICTIONARY_ID = 'premium_spotlight_school' as const;
export const SPOTLIGHT_ALL_SECTIONS_ID = 'all' as const;

export type SpotlightGradeNumber = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface SpotlightDictionaryWord {
  word: string;
  translation: string;
}

export interface SpotlightDictionarySection {
  id: string;
  kind: 'core' | 'supplement';
  label: string;
  title: string;
  hidden: boolean;
  words: SpotlightDictionaryWord[];
}

export interface SpotlightDictionaryGrade {
  grade: SpotlightGradeNumber;
  sections: SpotlightDictionarySection[];
}

export interface SpotlightDictionaryFile {
  id: typeof SPOTLIGHT_PREMIUM_DICTIONARY_ID;
  version: number;
  title: string;
  shortTitle: string;
  theme: string;
  grades: SpotlightDictionaryGrade[];
}

export interface SpotlightSectionOption {
  id: string;
  label: string;
  title: string;
  kind: 'core' | 'supplement';
  wordCount: number;
}

export interface SpotlightSelection {
  grade: SpotlightGradeNumber;
  sectionId: string;
}

const WORD_PATTERN = /^[A-Z]{1,18}$/;
const GRADES: SpotlightGradeNumber[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SPOTLIGHT_STORAGE_PREFIX = 'annword_spotlight_selection_v1:';

let spotlightDictionary: SpotlightDictionaryFile | null = null;
let spotlightPromise: Promise<SpotlightDictionaryFile> | null = null;

const isSpotlightGrade = (value: unknown): value is SpotlightGradeNumber =>
  typeof value === 'number' && GRADES.includes(value as SpotlightGradeNumber);

const normalizeGrade = (value?: number): SpotlightGradeNumber => isSpotlightGrade(value) ? value : 2;

const normalizeSectionId = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : SPOTLIGHT_ALL_SECTIONS_ID;

export const readStoredSpotlightSelection = (username: string): SpotlightSelection => {
  if (typeof window === 'undefined') return { grade: 2, sectionId: SPOTLIGHT_ALL_SECTIONS_ID };
  try {
    const raw = window.localStorage.getItem(`${SPOTLIGHT_STORAGE_PREFIX}${username || 'guest'}`);
    const parsed = raw ? JSON.parse(raw) as { grade?: unknown; sectionId?: unknown } : null;
    return {
      grade: isSpotlightGrade(parsed?.grade) ? parsed.grade : 2,
      sectionId: normalizeSectionId(parsed?.sectionId),
    };
  } catch {
    return { grade: 2, sectionId: SPOTLIGHT_ALL_SECTIONS_ID };
  }
};

export const resolveSpotlightSelection = (
  grade: number | undefined,
  sectionId: string | undefined,
  username: string,
): SpotlightSelection => {
  const stored = readStoredSpotlightSelection(username);
  const hasExplicitGrade = isSpotlightGrade(grade);
  return {
    grade: hasExplicitGrade ? grade : stored.grade,
    sectionId: sectionId?.trim()
      ? sectionId.trim()
      : hasExplicitGrade
        ? SPOTLIGHT_ALL_SECTIONS_ID
        : stored.sectionId,
  };
};

const normalizeEntry = (entry: SpotlightDictionaryWord): SpotlightDictionaryWord | null => {
  const word = String(entry?.word || '').trim().toUpperCase();
  const translation = String(entry?.translation || '').trim();
  if (!WORD_PATTERN.test(word) || !translation) return null;
  return { word, translation };
};

const mergeEntries = (entries: SpotlightDictionaryWord[]): EnrichedWord[] => {
  const byWord = new Map<string, { translations: string[] }>();
  for (const rawEntry of entries) {
    const entry = normalizeEntry(rawEntry);
    if (!entry) continue;
    const current = byWord.get(entry.word) || { translations: [] };
    if (!current.translations.includes(entry.translation)) current.translations.push(entry.translation);
    byWord.set(entry.word, current);
  }
  return Array.from(byWord.entries()).map(([word, value]) => ({
    word,
    translation: value.translations.join('; '),
    level: 'Spotlight',
  }));
};

export const ensureSpotlightDictionaryLoaded = async (): Promise<SpotlightDictionaryFile> => {
  if (spotlightDictionary) return spotlightDictionary;
  if (!spotlightPromise) {
    spotlightPromise = import('../dictionaries/premium/spotlight/spotlight_source_2_11.json')
      .then(module => {
        const file = module.default as SpotlightDictionaryFile;
        if (file?.id !== SPOTLIGHT_PREMIUM_DICTIONARY_ID || !Array.isArray(file.grades)) {
          throw new Error('Файл Spotlight имеет неверную структуру.');
        }
        spotlightDictionary = file;
        return file;
      })
      .catch(error => {
        spotlightPromise = null;
        throw error;
      });
  }
  return spotlightPromise;
};

export const readSpotlightDictionary = (): SpotlightDictionaryFile | null => spotlightDictionary;

export const getSpotlightGrades = (): SpotlightGradeNumber[] => [...GRADES];

export const getSpotlightSections = (grade?: number, includeHidden = false): SpotlightSectionOption[] => {
  const gradeData = spotlightDictionary?.grades.find(item => item.grade === normalizeGrade(grade));
  if (!gradeData) return [];
  return gradeData.sections
    .filter(section => includeHidden || !section.hidden)
    .map(section => ({
      id: section.id,
      label: section.label,
      title: section.title,
      kind: section.kind,
      wordCount: mergeEntries(section.words).length,
    }));
};

export const getSpotlightEntries = (grade?: number, sectionId?: string): EnrichedWord[] => {
  const gradeData = spotlightDictionary?.grades.find(item => item.grade === normalizeGrade(grade));
  if (!gradeData) return [];
  const normalizedSectionId = sectionId || SPOTLIGHT_ALL_SECTIONS_ID;
  if (normalizedSectionId === SPOTLIGHT_ALL_SECTIONS_ID) {
    return mergeEntries(gradeData.sections.flatMap(section => section.words));
  }
  const section = gradeData.sections.find(item => item.id === normalizedSectionId && !item.hidden);
  return section ? mergeEntries(section.words) : [];
};

export const getSpotlightSelectionLabel = (grade?: number, sectionId?: string): string => {
  const normalizedGrade = normalizeGrade(grade);
  if (!sectionId || sectionId === SPOTLIGHT_ALL_SECTIONS_ID) return `${normalizedGrade} класс · Весь класс`;
  const section = getSpotlightSections(normalizedGrade).find(item => item.id === sectionId);
  return `${normalizedGrade} класс · ${section?.label || 'Раздел недоступен'}`;
};

export const resetSpotlightDictionaryForTests = (): void => {
  spotlightDictionary = null;
  spotlightPromise = null;
};
