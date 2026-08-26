import type { ManagedLearner, WordPerformance } from '../types';
import { getWordLearningSummary } from './wordLearningStats';

export interface LearnerProgressMetrics {
  gamesPlayed: number;
  gamesWon: number;
  encounteredWords: number;
  errorWords: number;
  learnedWords: number;
  activeReviewWords: number;
  fixedAfterMistakeWords: number;
}

export interface TeacherLearnerSummary extends LearnerProgressMetrics {
  learners: number;
  accuracy: number;
}

const attempts = (word: WordPerformance): number => Math.max(0, Math.round(word.attempts || 0));
const accuracy = (word: WordPerformance): number => attempts(word) ? Math.round(word.correct / attempts(word) * 100) : 0;
const learned = (word: WordPerformance): boolean => word.correct > 0 && accuracy(word) >= 80;

export const getLearnerProgressMetrics = (learner: ManagedLearner): LearnerProgressMetrics => {
  const encountered = Object.values(learner.stats.wordPerformance ?? {}).filter(word => attempts(word) > 0);
  const learning = getWordLearningSummary(learner.stats);
  return {
    gamesPlayed: Math.max(0, learner.stats.gamesPlayed || 0),
    gamesWon: Math.max(0, learner.stats.gamesWon || 0),
    encounteredWords: encountered.length,
    errorWords: encountered.filter(word => word.mistakes > 0).length,
    learnedWords: encountered.filter(learned).length,
    activeReviewWords: learning.activeReview.length,
    fixedAfterMistakeWords: learning.fixedAfterMistake.length,
  };
};

export const getTeacherLearnerSummary = (learners: ManagedLearner[]): TeacherLearnerSummary => {
  const totals = learners.reduce<LearnerProgressMetrics>((sum, learner) => {
    const metrics = getLearnerProgressMetrics(learner);
    return {
      gamesPlayed: sum.gamesPlayed + metrics.gamesPlayed,
      gamesWon: sum.gamesWon + metrics.gamesWon,
      encounteredWords: sum.encounteredWords + metrics.encounteredWords,
      errorWords: sum.errorWords + metrics.errorWords,
      learnedWords: sum.learnedWords + metrics.learnedWords,
      activeReviewWords: sum.activeReviewWords + metrics.activeReviewWords,
      fixedAfterMistakeWords: sum.fixedAfterMistakeWords + metrics.fixedAfterMistakeWords,
    };
  }, { gamesPlayed: 0, gamesWon: 0, encounteredWords: 0, errorWords: 0, learnedWords: 0, activeReviewWords: 0, fixedAfterMistakeWords: 0 });

  return {
    learners: learners.length,
    ...totals,
    accuracy: totals.gamesPlayed ? Math.round(totals.gamesWon / totals.gamesPlayed * 100) : 0,
  };
};
