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
  sectionIds: string[];
  /** Legacy single-module field kept while older clients/settings are migrated. */
  sectionId: string;
}

const WORD_PATTERN = /^[A-Z]{1,18}$/;
const GRADES: SpotlightGradeNumber[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SPOTLIGHT_STORAGE_PREFIX = 'annword_spotlight_selection_v1:';
const MAX_COMPACT_SECTION_TITLE_LENGTH = 28;

let spotlightDictionary: SpotlightDictionaryFile | null = null;
let spotlightPromise: Promise<SpotlightDictionaryFile> | null = null;

const isSpotlightGrade = (value: unknown): value is SpotlightGradeNumber =>
  typeof value === 'number' && GRADES.includes(value as SpotlightGradeNumber);

const normalizeGrade = (value?: number): SpotlightGradeNumber => isSpotlightGrade(value) ? value : 2;

export const normalizeSpotlightSectionIds = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : [value];
  const ids = Array.from(new Set(raw
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)));
  if (ids.length === 0 || ids.includes(SPOTLIGHT_ALL_SECTIONS_ID)) return [SPOTLIGHT_ALL_SECTIONS_ID];
  return ids;
};

const legacySectionId = (sectionIds: string[]): string =>
  sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID) ? SPOTLIGHT_ALL_SECTIONS_ID : sectionIds[0] || SPOTLIGHT_ALL_SECTIONS_ID;

export const canonicalizeSpotlightSectionIds = (grade?: number, value?: string | string[]): string[] => {
  const normalized = normalizeSpotlightSectionIds(value);
  if (normalized.includes(SPOTLIGHT_ALL_SECTIONS_ID)) return [SPOTLIGHT_ALL_SECTIONS_ID];
  const gradeData = spotlightDictionary?.grades.find(item => item.grade === normalizeGrade(grade));
  if (!gradeData) return normalized;
  const selected = new Set(normalized);
  const ordered = gradeData.sections
    .filter(section => !section.hidden && selected.has(section.id))
    .map(section => section.id);
  return ordered.length > 0 ? ordered : [SPOTLIGHT_ALL_SECTIONS_ID];
};

export const readStoredSpotlightSelection = (username: string): SpotlightSelection => {
  const fallback: SpotlightSelection = { grade: 2, sectionIds: [SPOTLIGHT_ALL_SECTIONS_ID], sectionId: SPOTLIGHT_ALL_SECTIONS_ID };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${SPOTLIGHT_STORAGE_PREFIX}${username || 'guest'}`);
    const parsed = raw ? JSON.parse(raw) as { grade?: unknown; sectionIds?: unknown; sectionId?: unknown } : null;
    const sectionIds = normalizeSpotlightSectionIds(Array.isArray(parsed?.sectionIds) ? parsed?.sectionIds : parsed?.sectionId);
    return {
      grade: isSpotlightGrade(parsed?.grade) ? parsed.grade : 2,
      sectionIds,
      sectionId: legacySectionId(sectionIds),
    };
  } catch {
    return fallback;
  }
};

export const storeSpotlightSelection = (username: string, selection: { grade: SpotlightGradeNumber; sectionIds?: string[]; sectionId?: string }): void => {
  if (typeof window === 'undefined') return;
  const sectionIds = canonicalizeSpotlightSectionIds(selection.grade, selection.sectionIds?.length ? selection.sectionIds : selection.sectionId);
  try {
    window.localStorage.setItem(`${SPOTLIGHT_STORAGE_PREFIX}${username || 'guest'}`, JSON.stringify({
      grade: selection.grade,
      sectionIds,
      sectionId: legacySectionId(sectionIds),
    }));
  } catch {
    // Local fallback must not block the canonical server selection.
  }
};

export const resolveSpotlightSelection = (
  grade: number | undefined,
  sectionIdsOrLegacy: string | string[] | undefined,
  username: string,
): SpotlightSelection => {
  const stored = readStoredSpotlightSelection(username);
  const hasExplicitGrade = isSpotlightGrade(grade);
  const requested = Array.isArray(sectionIdsOrLegacy)
    ? sectionIdsOrLegacy
    : typeof sectionIdsOrLegacy === 'string' && sectionIdsOrLegacy.trim()
      ? [sectionIdsOrLegacy]
      : hasExplicitGrade
        ? [SPOTLIGHT_ALL_SECTIONS_ID]
        : stored.sectionIds;
  const resolvedGrade = hasExplicitGrade ? grade : stored.grade;
  const sectionIds = canonicalizeSpotlightSectionIds(resolvedGrade, requested);
  return { grade: resolvedGrade, sectionIds, sectionId: legacySectionId(sectionIds) };
};

export const toggleSpotlightSectionSelection = (
  grade: number,
  currentSectionIds: string[],
  sectionId: string,
): string[] => {
  if (sectionId === SPOTLIGHT_ALL_SECTIONS_ID) return [SPOTLIGHT_ALL_SECTIONS_ID];
  const current = canonicalizeSpotlightSectionIds(grade, currentSectionIds);
  if (current.includes(SPOTLIGHT_ALL_SECTIONS_ID)) return canonicalizeSpotlightSectionIds(grade, [sectionId]);
  const exists = current.includes(sectionId);
  const next = exists ? current.filter(id => id !== sectionId) : [...current, sectionId];
  if (next.length === 0) return current;
  return canonicalizeSpotlightSectionIds(grade, next);
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

export const getSpotlightEntries = (grade?: number, sectionIdsOrLegacy?: string | string[]): EnrichedWord[] => {
  const gradeData = spotlightDictionary?.grades.find(item => item.grade === normalizeGrade(grade));
  if (!gradeData) return [];
  const requestedSectionIds = normalizeSpotlightSectionIds(sectionIdsOrLegacy);
  if (!requestedSectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID)) {
    const visibleSectionIds = new Set(gradeData.sections.filter(section => !section.hidden).map(section => section.id));
    if (!requestedSectionIds.some(sectionId => visibleSectionIds.has(sectionId))) return [];
  }
  const sectionIds = canonicalizeSpotlightSectionIds(grade, requestedSectionIds);
  if (sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID)) {
    return mergeEntries(gradeData.sections.flatMap(section => section.words));
  }
  const selected = new Set(sectionIds);
  return mergeEntries(gradeData.sections
    .filter(section => !section.hidden && selected.has(section.id))
    .flatMap(section => section.words));
};

const getSelectedSectionTitles = (grade: SpotlightGradeNumber, sectionIdsOrLegacy?: string | string[]): string[] => {
  const sectionIds = canonicalizeSpotlightSectionIds(grade, sectionIdsOrLegacy);
  if (sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID)) return [];
  const selected = new Set(sectionIds);
  return getSpotlightSections(grade).filter(section => selected.has(section.id)).map(section => section.title);
};

const compactSectionTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_COMPACT_SECTION_TITLE_LENGTH) return trimmed;
  const prefix = trimmed.match(/^(?:module|модуль)\s*\d+[a-zа-я]?/i)?.[0];
  return prefix || `${trimmed.slice(0, MAX_COMPACT_SECTION_TITLE_LENGTH - 1).trim()}…`;
};

export const getSpotlightSelectionLabel = (grade?: number, sectionIdsOrLegacy?: string | string[]): string => {
  const normalizedGrade = normalizeGrade(grade);
  const sectionIds = canonicalizeSpotlightSectionIds(normalizedGrade, sectionIdsOrLegacy);
  if (sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID)) return `${normalizedGrade} класс · Весь класс`;
  const titles = getSelectedSectionTitles(normalizedGrade, sectionIds);
  return `${normalizedGrade} класс · ${titles.length ? titles.join(' + ') : 'Раздел недоступен'}`;
};

export const getSpotlightCompactSelectionLabel = (grade?: number, sectionIdsOrLegacy?: string | string[]): string => {
  const normalizedGrade = normalizeGrade(grade);
  const sectionIds = canonicalizeSpotlightSectionIds(normalizedGrade, sectionIdsOrLegacy);
  if (sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID)) return `${normalizedGrade} класс · Весь класс`;
  const titles = getSelectedSectionTitles(normalizedGrade, sectionIds).map(compactSectionTitle);
  if (titles.length <= 2) return `${normalizedGrade} класс · ${titles.join(' + ') || 'Раздел недоступен'}`;
  return `${normalizedGrade} класс · ${titles.slice(0, 2).join(' + ')} + ещё ${titles.length - 2}`;
};

export const resetSpotlightDictionaryForTests = (): void => {
  spotlightDictionary = null;
  spotlightPromise = null;
};
