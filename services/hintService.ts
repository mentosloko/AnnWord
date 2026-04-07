import { CharStatus } from "../types";

/**
 * Finds the word from the dictionary that contains the highest number of 
 * letters NOT yet guessed by the user.
 * 
 * Strategy: Elimination / Information Gain.
 */
export const getBestEliminationHint = (
  secretWord: string,
  guesses: string[],
  dictionary: string[]
): string | null => {
  // 1. Identify all letters used so far
  const usedLetters = new Set<string>();
  guesses.forEach(guess => {
    guess.split('').forEach(char => usedLetters.add(char));
  });

  let bestWord: string | null = null;
  let maxNewLettersCount = -1;

  // 2. Iterate dictionary to find the best probe word
  for (const word of dictionary) {
    // Do not suggest the secret word itself (hint shouldn't solve it immediately)
    if (word === secretWord) continue;

    // Do not suggest words already guessed
    if (guesses.includes(word)) continue;

    // Calculate score: count of unique letters in 'word' that are NOT in 'usedLetters'
    const uniqueLettersInWord = new Set(word.split(''));
    let score = 0;
    
    uniqueLettersInWord.forEach(char => {
      if (!usedLetters.has(char)) {
        score++;
      }
    });

    if (score > maxNewLettersCount) {
      maxNewLettersCount = score;
      bestWord = word;
    }
  }

  return bestWord;
};