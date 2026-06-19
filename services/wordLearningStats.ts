import { UserStats, WordLearningHistory } from '../types';

const safeNumber = (value: unknown): number => Math.max(0, Math.round(typeof value === 'number' ? value : 0));

export const getWordLearningHistoryEntries = (stats: UserStats): WordLearningHistory[] => {
  const explicit = Object.values(stats.wordLearningHistory || {});
  const explicitWords = new Set(explicit.map(item => item.word));
  const fallback = Object.values(stats.wordPerformance || {})
    .filter(item => !explicitWords.has(item.word) && safeNumber(item.mistakes) > 0)
    .map(item => ({
      word: item.word,
      lastMistakeAt: item.lastPracticedAt,
      lastResolvedAt: safeNumber(item.correct) > 0 && !stats.wordsToReview?.[item.word] ? item.lastPracticedAt : undefined,
      mistakeCount: safeNumber(item.mistakes),
      resolvedCount: safeNumber(item.correct) > 0 && !stats.wordsToReview?.[item.word] ? 1 : 0,
      currentReviewPriority: safeNumber(stats.wordsToReview?.[item.word]),
      events: [],
    }));
  return [...explicit, ...fallback].sort((a, b) => (b.lastMistakeAt || b.lastResolvedAt || '').localeCompare(a.lastMistakeAt || a.lastResolvedAt || ''));
};

export const getWordLearningSummary = (stats: UserStats) => {
  const entries = getWordLearningHistoryEntries(stats);
  const activeReview = entries.filter(item => safeNumber(item.currentReviewPriority) > 0);
  const fixedAfterMistake = entries.filter(item => safeNumber(item.mistakeCount) > 0 && safeNumber(item.resolvedCount) > 0 && safeNumber(item.currentReviewPriority) === 0);
  const totalMistakes = entries.reduce((sum, item) => sum + safeNumber(item.mistakeCount), 0);
  const totalResolutions = entries.reduce((sum, item) => sum + safeNumber(item.resolvedCount), 0);
  return {
    entries,
    activeReview,
    fixedAfterMistake,
    totalDifficultWords: entries.filter(item => safeNumber(item.mistakeCount) > 0).length,
    totalMistakes,
    totalResolutions,
  };
};

export const getRecentFixedWords = (stats: UserStats, limit = 8): WordLearningHistory[] => getWordLearningHistoryEntries(stats)
  .filter(item => safeNumber(item.resolvedCount) > 0 && safeNumber(item.currentReviewPriority) === 0)
  .sort((a, b) => (b.lastResolvedAt || '').localeCompare(a.lastResolvedAt || ''))
  .slice(0, limit);
