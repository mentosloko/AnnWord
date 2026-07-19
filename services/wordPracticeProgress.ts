import { normalizeWord } from './wordNormalization';

export type WordPracticeResult = 'failed' | 'mastered';

export const updateReviewPriorities = (
  current: Record<string, number> = {},
  word: string,
  result: WordPracticeResult,
): Record<string, number> => {
  const normalized = normalizeWord(word);
  if (!normalized) return { ...current };
  const next = { ...current };
  if (result === 'mastered') {
    delete next[normalized];
    return next;
  }
  next[normalized] = Math.min(4, Math.max(0, Math.round(next[normalized] || 0)) + 1);
  return next;
};
