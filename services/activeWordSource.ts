import type { ActiveWordSource, DifficultyLevel, GameSettings } from '../types';

const DIFFICULTIES = new Set<DifficultyLevel>(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const DEFAULT_ACTIVE_WORD_SOURCE: ActiveWordSource = { source: 'builtin', difficulty: 'ALL' };

const readDifficulty = (value: unknown): DifficultyLevel =>
  typeof value === 'string' && DIFFICULTIES.has(value as DifficultyLevel) ? value as DifficultyLevel : 'ALL';

const readUpdatedAt = (value: unknown): string | undefined => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

export const normalizeActiveWordSource = (value: unknown): ActiveWordSource => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_ACTIVE_WORD_SOURCE };
  const record = value as Record<string, unknown>;
  const source = record.source === 'custom' || record.source === 'premium' ? record.source : 'builtin';
  const difficulty = readDifficulty(record.difficulty);
  const updatedAt = readUpdatedAt(record.updatedAt);
  if (source !== 'premium') return { source, difficulty, updatedAt };

  const premiumDictionaryId = typeof record.premiumDictionaryId === 'string' && record.premiumDictionaryId.trim()
    ? record.premiumDictionaryId.trim()
    : undefined;
  const spotlightGrade = typeof record.spotlightGrade === 'number' && Number.isInteger(record.spotlightGrade) && record.spotlightGrade >= 2 && record.spotlightGrade <= 11
    ? record.spotlightGrade
    : undefined;
  const spotlightSectionId = typeof record.spotlightSectionId === 'string' && record.spotlightSectionId.trim()
    ? record.spotlightSectionId.trim()
    : undefined;
  return { source, difficulty, premiumDictionaryId, spotlightGrade, spotlightSectionId, updatedAt };
};

export const activeWordSourceFromSettings = (settings: GameSettings): ActiveWordSource => normalizeActiveWordSource({
  source: settings.dictionarySource,
  difficulty: settings.difficulty,
  premiumDictionaryId: settings.dictionarySource === 'premium' ? settings.activePremiumDictionaryId : undefined,
  spotlightGrade: settings.dictionarySource === 'premium' ? settings.activeSpotlightGrade : undefined,
  spotlightSectionId: settings.dictionarySource === 'premium' ? settings.activeSpotlightSectionId : undefined,
});

export const applyActiveWordSourceToSettings = (settings: GameSettings, value: unknown): GameSettings => {
  const source = normalizeActiveWordSource(value);
  return {
    ...settings,
    dictionarySource: source.source,
    useCustomDictionary: source.source === 'custom',
    difficulty: source.difficulty,
    activePremiumDictionaryId: source.source === 'premium' ? source.premiumDictionaryId : undefined,
    activeSpotlightGrade: source.source === 'premium' ? source.spotlightGrade : undefined,
    activeSpotlightSectionId: source.source === 'premium' ? source.spotlightSectionId : undefined,
  };
};

export const activeWordSourceKey = (value: unknown): string => {
  const source = normalizeActiveWordSource(value);
  return [source.source, source.difficulty, source.premiumDictionaryId || '', source.spotlightGrade || '', source.spotlightSectionId || ''].join(':');
};
