import catalogJson from '../dictionaries/premium/spotlight/spotlight_catalog.json';
import type { EnrichedWord, GameSettings } from '../types';

export const SPOTLIGHT_DICTIONARY_ID = 'premium_spotlight_school' as const;
export const SPOTLIGHT_ALL_SECTION_ID = 'all';

export type SpotlightGrade = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type SpotlightSectionKind = 'core' | 'supplement';

export interface SpotlightSectionMeta {
  id: string;
  kind: SpotlightSectionKind;
  label: string;
  title: string;
  wordCount: number;
}

export interface SpotlightGradeMeta {
  grade: SpotlightGrade;
  title: string;
  wordCount: number;
  modules: SpotlightSectionMeta[];
  supplements: SpotlightSectionMeta[];
}

type SpotlightCatalogFile = {
  version: number;
  familyId: string;
  title: string;
  grades: SpotlightGradeMeta[];
};

type SpotlightRuntimeSection = Omit<SpotlightSectionMeta, 'wordCount'> & {
  wordIndexes: number[];
};

type SpotlightRuntimeFile = {
  grade: SpotlightGrade;
  words: Array<[string, string]>;
  sections: SpotlightRuntimeSection[];
};

const catalog = catalogJson as SpotlightCatalogFile;
const grades = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const gradeLoaders: Record<SpotlightGrade, () => Promise<SpotlightRuntimeFile>> = {
  2: () => import('../dictionaries/premium/spotlight/spotlight_grade_2.json').then(module => module.default as SpotlightRuntimeFile),
  3: () => import('../dictionaries/premium/spotlight/spotlight_grade_3.json').then(module => module.default as SpotlightRuntimeFile),
  4: () => import('../dictionaries/premium/spotlight/spotlight_grade_4.json').then(module => module.default as SpotlightRuntimeFile),
  5: () => import('../dictionaries/premium/spotlight/spotlight_grade_5.json').then(module => module.default as SpotlightRuntimeFile),
  6: () => import('../dictionaries/premium/spotlight/spotlight_grade_6.json').then(module => module.default as SpotlightRuntimeFile),
  7: () => import('../dictionaries/premium/spotlight/spotlight_grade_7.json').then(module => module.default as SpotlightRuntimeFile),
  8: () => import('../dictionaries/premium/spotlight/spotlight_grade_8.json').then(module => module.default as SpotlightRuntimeFile),
  9: () => import('../dictionaries/premium/spotlight/spotlight_grade_9.json').then(module => module.default as SpotlightRuntimeFile),
  10: () => import('../dictionaries/premium/spotlight/spotlight_grade_10.json').then(module => module.default as SpotlightRuntimeFile),
  11: () => import('../dictionaries/premium/spotlight/spotlight_grade_11.json').then(module => module.default as SpotlightRuntimeFile),
};

const gradeCache = new Map<SpotlightGrade, SpotlightRuntimeFile>();
const gradePromises = new Map<SpotlightGrade, Promise<SpotlightRuntimeFile>>();

export const isSpotlightDictionaryId = (id?: string | null): boolean => id === SPOTLIGHT_DICTIONARY_ID;

export const resolveSpotlightGrade = (value?: number | null): SpotlightGrade =>
  grades.includes(value as SpotlightGrade) ? value as SpotlightGrade : 2;

export const getSpotlightGradeCatalog = (): SpotlightGradeMeta[] => catalog.grades;

export const getSpotlightGradeMeta = (value?: number | null): SpotlightGradeMeta => {
  const grade = resolveSpotlightGrade(value);
  return catalog.grades.find(item => item.grade === grade) || catalog.grades[0];
};

export const resolveSpotlightSectionId = (gradeValue?: number | null, sectionId?: string | null): string => {
  if (!sectionId || sectionId === SPOTLIGHT_ALL_SECTION_ID) return SPOTLIGHT_ALL_SECTION_ID;
  const grade = getSpotlightGradeMeta(gradeValue);
  return [...grade.modules, ...grade.supplements].some(item => item.id === sectionId)
    ? sectionId
    : SPOTLIGHT_ALL_SECTION_ID;
};

export const getSpotlightSectionMeta = (gradeValue?: number | null, sectionId?: string | null): SpotlightSectionMeta | null => {
  const resolved = resolveSpotlightSectionId(gradeValue, sectionId);
  if (resolved === SPOTLIGHT_ALL_SECTION_ID) return null;
  const grade = getSpotlightGradeMeta(gradeValue);
  return [...grade.modules, ...grade.supplements].find(item => item.id === resolved) || null;
};

export const getSpotlightDictionaryMeta = () => ({
  id: SPOTLIGHT_DICTIONARY_ID,
  title: 'Spotlight 2–11',
  shortTitle: 'Spotlight',
  theme: 'school',
  icon: '📘',
  kind: 'series' as const,
  description: 'Школьная программа по классам и модулям',
  wordCount: catalog.grades.reduce((sum, grade) => sum + grade.wordCount, 0),
});

export const getSpotlightSelectionLabel = (settings: Pick<GameSettings, 'activeSpotlightGrade' | 'activeSpotlightSectionId'>): string => {
  const grade = getSpotlightGradeMeta(settings.activeSpotlightGrade);
  const section = getSpotlightSectionMeta(grade.grade, settings.activeSpotlightSectionId);
  if (!section) return `Spotlight · ${grade.grade} класс · весь класс`;
  const title = section.title && section.title !== section.label ? ` · ${section.title}` : '';
  return `Spotlight · ${grade.grade} класс · ${section.label}${title}`;
};

export const getSpotlightSelectionWordCount = (settings: Pick<GameSettings, 'activeSpotlightGrade' | 'activeSpotlightSectionId'>): number => {
  const grade = getSpotlightGradeMeta(settings.activeSpotlightGrade);
  return getSpotlightSectionMeta(grade.grade, settings.activeSpotlightSectionId)?.wordCount || grade.wordCount;
};

export const ensureSpotlightGradeLoaded = async (value?: number | null): Promise<SpotlightRuntimeFile> => {
  const grade = resolveSpotlightGrade(value);
  const cached = gradeCache.get(grade);
  if (cached) return cached;
  const pending = gradePromises.get(grade);
  if (pending) return pending;
  const promise = gradeLoaders[grade]()
    .then(file => {
      gradeCache.set(grade, file);
      gradePromises.delete(grade);
      return file;
    })
    .catch(error => {
      gradePromises.delete(grade);
      throw error;
    });
  gradePromises.set(grade, promise);
  return promise;
};

export const readSpotlightGrade = (value?: number | null): SpotlightRuntimeFile | null =>
  gradeCache.get(resolveSpotlightGrade(value)) || null;

export const getSpotlightEntries = (gradeValue?: number | null, sectionId?: string | null): EnrichedWord[] => {
  const file = readSpotlightGrade(gradeValue);
  if (!file) return [];
  const resolvedSectionId = resolveSpotlightSectionId(file.grade, sectionId);
  const indexes = resolvedSectionId === SPOTLIGHT_ALL_SECTION_ID
    ? file.words.map((_, index) => index)
    : file.sections.find(section => section.id === resolvedSectionId)?.wordIndexes || [];
  return indexes
    .map(index => file.words[index])
    .filter((item): item is [string, string] => Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'string')
    .map(([word, translation]) => ({ word, translation, level: 'ALL' }));
};

export const resetSpotlightRuntimeForTests = (): void => {
  gradeCache.clear();
  gradePromises.clear();
};
