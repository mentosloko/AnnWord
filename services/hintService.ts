import { CharStatus } from "../types";
import { getGuessLetterStatuses } from "../hooks/useClassicGameController";

const doesCandidateMatchFeedback = (candidate: string, guess: string, secretWord: string): boolean => {
  const statuses = getGuessLetterStatuses(guess, secretWord);

  return guess.split('').every((char, index) => {
    const status = statuses[index];

    if (status === 'correct') return candidate[index] === char;
    if (status === 'present') return candidate.includes(char) && candidate[index] !== char;
    return !candidate.includes(char);
  });
};

const countKnownLetters = (word: string, guesses: string[], secretWord: string): number => {
  const knownLetters = new Set<string>();

  guesses.forEach(guess => {
    const statuses = getGuessLetterStatuses(guess, secretWord);
    guess.split('').forEach((char, index) => {
      if (statuses[index] === 'correct' || statuses[index] === 'present') knownLetters.add(char);
    });
  });

  return word.split('').reduce((score, char) => score + (knownLetters.has(char) ? 1 : 0), 0);
};

/**
 * Finds a useful probe word without revealing the secret word.
 *
 * Strategy:
 * - never suggest the secret word or an already guessed word;
 * - after successful guesses, prefer words that are compatible with known
 *   green/yellow/gray feedback;
 * - keep some variation by choosing randomly among the best scored candidates.
 */
export const getBestEliminationHint = (
  secretWord: string,
  guesses: string[],
  dictionary: string[]
): string | null => {
  const normalizedSecret = secretWord.toUpperCase();
  const normalizedGuesses = guesses.map(guess => guess.toUpperCase());
  const usedLetters = new Set<string>();

  normalizedGuesses.forEach(guess => {
    guess.split('').forEach(char => usedLetters.add(char));
  });

  const baseCandidates = dictionary
    .map(word => word.toUpperCase())
    .filter(word => word.length === normalizedSecret.length)
    .filter(word => word !== normalizedSecret)
    .filter(word => !normalizedGuesses.includes(word));

  const feedbackCandidates = normalizedGuesses.length > 0
    ? baseCandidates.filter(word => normalizedGuesses.every(guess => doesCandidateMatchFeedback(word, guess, normalizedSecret)))
    : baseCandidates;

  const candidates = feedbackCandidates.length > 0 ? feedbackCandidates : baseCandidates;
  if (candidates.length === 0) return null;

  const scored = candidates.map(word => {
    const uniqueLettersInWord = new Set(word.split(''));
    let newLettersScore = 0;

    uniqueLettersInWord.forEach(char => {
      if (!usedLetters.has(char)) newLettersScore += 1;
    });

    const knownLettersScore = countKnownLetters(word, normalizedGuesses, normalizedSecret);
    return { word, score: newLettersScore + knownLettersScore * 1.5 };
  });

  scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  const topScore = scored[0]?.score;
  const topCandidates = scored.filter(item => item.score === topScore).slice(0, 12);
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return selected?.word ?? null;
};