import type { EnrichedWord, GameSettings, SpotlightGrade } from '../types';
import spotlightIndexJson from '../dictionaries/premium/spotlight/spotlight.index.json';

export const SPOTLIGHT_DICTIONARY_ID = 'premium_spotlight_school' as const;
export interface SpotlightWord {
  word: string;
  translation: string;
}

export interface SpotlightSection {
  id: string;
  kind: 'core' | 'supplement';
  label: string;
  title: string;
  hidden: boolean;
  words: SpotlightWord[];
}

export interface SpotlightGradeFile {
  grade: SpotlightGrade;
  sections: SpotlightSection[];
}

export interface SpotlightSectionMeta {
  id: string;
  kind: 'core' | 'supplement';
  label: string;
  title: string;
  hidden: boolean;
  wordCount: number;
}

export interface SpotlightGradeMeta {
  grade: SpotlightGrade;
  wordCount: number;
  entryCount: number;
  sections: SpotlightSectionMeta[];
}

interface SpotlightIndexFile {
  id: typeof SPOTLIGHT_DICTIONARY_ID;
  version: number;
  title: string;
  shortTitle: string;
  theme: string;
  grades: SpotlightGradeMeta[];
}

const spotlightIndex = spotlightIndexJson as SpotlightIndexFile;

const gradeLoaders: Record<SpotlightGrade, () => Promise<SpotlightGradeFile>> = {
  2: () => import('../dictionaries/premium/spotlight/spotlight_grade_2.json').then(module => module.default as SpotlightGradeFile),
  3: () => import('../dictionaries/premium/spotlight/spotlight_grade_3.json').then(module => module.default as SpotlightGradeFile),
  4: () => import('../dictionaries/premium/spotlight/spotlight_grade_4.json').then(module => module.default as SpotlightGradeFile),
  5: () => import('../dictionaries/premium/spotlight/spotlight_grade_5.json').then(module => module.default as SpotlightGradeFile),
  6: () => import('../dictionaries/premium/spotlight/spotlight_grade_6.json').then(module => module.default as SpotlightGradeFile),
  7: () => import('../dictionaries/premium/spotlight/spotlight_grade_7.json').then(module => module.default as SpotlightGradeFile),
  8: () => import('../dictionaries/premium/spotlight/spotlight_grade_8.json').then(module => module.default as SpotlightGradeFile),
  9: () => import('../dictionaries/premium/spotlight/spotlight_grade_9.json').then(module => module.default as SpotlightGradeFile),
  10: () => import('../dictionaries/premium/spotlight/spotlight_grade_10.json').then(module => module.default as SpotlightGradeFile),
  11: () => import('../dictionaries/premium/spotlight/spotlight_grade_11.json').then(module => module.default as SpotlightGradeFile),
};

const loadedGrades = new Map<SpotlightGrade, SpotlightGradeFile>();
const pendingGrades = new Map<SpotlightGrade, Promise<SpotlightGradeFile>>();

export const isSpotlightDictionaryId = (id?: string | null): boolean => id === SPOTLIGHT_DICTIONARY_ID;

export const getSpotlightIndex = (): SpotlightIndexFile => spotlightIndex;

export const getDefaultSpotlightGrade = (): SpotlightGrade => 2;

export const resolveSpotlightGrade = (value?: number | null): SpotlightGrade =>
  spotlightIndex.grades.some(item => item.grade === value)
    ? value as SpotlightGrade
    : getDefaultSpotlightGrade();

export const getSpotlightGradeMeta = (value?: number | null): SpotlightGradeMeta => {
  const grade = resolveSpotlightGrade(value);
  return spotlightIndex.grades.find(item => item.grade === grade) || spotlightIndex.grades[0];
};

export const resolveSpotlightSectionId = (gradeValue?: number | null, sectionId?: string | null): string | null => {
  if (!sectionId) return null;
  const grade = getSpotlightGradeMeta(gradeValue);
  const section = grade.sections.find(item => item.id === sectionId && !item.hidden);
  return section?.id || null;
};

export const getSpotlightSelectionLabel = (settings: Pick<GameSettings, 'activeSpotlightGrade' | 'activeSpotlightSectionId'>): string => {
  const grade = getSpotlightGradeMeta(settings.activeSpotlightGrade);
  const sectionId = resolveSpotlightSectionId(grade.grade, settings.activeSpotlightSectionId);
  const section = sectionId ? grade.sections.find(item => item.id === sectionId) : null;
  return `Spotlight · ${grade.grade} класс · ${section?.label || 'Весь класс'}`;
};

export const ensureSpotlightGradeLoaded = async (gradeValue?: number | null): Promise<SpotlightGradeFile> => {
  const grade = resolveSpotlightGrade(gradeValue);
  const cached = loadedGrades.get(grade);
  if (cached) return cached;
  const pending = pendingGrades.get(grade);
  if (pending) return pending;
  const promise = gradeLoaders[grade]()
    .then(file => {
      loadedGrades.set(grade, file);
      pendingGrades.delete(grade);
      return file;
    })
    .catch(error => {
      pendingGrades.delete(grade);
      throw error;
    });
  pendingGrades.set(grade, promise);
  return promise;
};

export const readSpotlightGrade = (gradeValue?: number | null): SpotlightGradeFile | null =>
  loadedGrades.get(resolveSpotlightGrade(gradeValue)) || null;

export const getLoadedSpotlightEntries = (gradeValue?: number | null, sectionId?: string | null): EnrichedWord[] => {
  const grade = resolveSpotlightGrade(gradeValue);
  const file = readSpotlightGrade(grade);
  if (!file) return [];
  const resolvedSectionId = resolveSpotlightSectionId(grade, sectionId);
  const sections = resolvedSectionId
    ? file.sections.filter(section => section.id === resolvedSectionId && !section.hidden)
    : file.sections;
  const seen = new Set<string>();
  const entries: EnrichedWord[] = [];
  for (const section of sections) {
    for (const item of section.words) {
      if (seen.has(item.word)) continue;
      seen.add(item.word);
      entries.push({ word: item.word, translation: item.translation, level: 'Spotlight' });
    }
  }
  return entries;
};

export const resetSpotlightRuntimeForTests = (): void => {
  loadedGrades.clear();
  pendingGrades.clear();
};
