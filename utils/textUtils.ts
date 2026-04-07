/**
 * Calculates the Levenshtein distance between two strings.
 * Used to determine if a user made a typo (distance 1 or 2).
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Finds the closest word in the dictionary to the input word.
 * Only considers words with the same length (or +/- 1 if desired, but Wordle is strict on length).
 * We assume Wordle input implies intended length is strict, but for typo detection 
 * in a general sense, we allow distance calculation.
 * 
 * Returns the closest word if distance <= threshold, else null.
 */
export const findClosestWord = (input: string, dictionary: string[], threshold: number = 1): string | null => {
  let closestWord = null;
  let minDistance = Infinity;

  // Optimization: Only check words of similar length to avoid expensive calcs on disparate words
  const len = input.length;
  
  for (const word of dictionary) {
    if (Math.abs(word.length - len) > 2) continue;

    const dist = levenshteinDistance(input, word);
    
    if (dist < minDistance) {
      minDistance = dist;
      closestWord = word;
    }
    
    // Exact match or very close, return early if possible (though exact match shouldn't happen here usually)
    if (dist === 0) return word;
  }

  return minDistance <= threshold ? closestWord : null;
};

/**
 * Scrambles a word for the mini-game.
 */
export const scrambleWord = (word: string): string => {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Ensure it's not same as original if possible
  const result = arr.join('');
  if (result === word && word.length > 1) return scrambleWord(word);
  return result;
};

/**
 * Replaces random letters with underscores for "Gap Fill" game.
 */
export const createGapWord = (word: string): { display: string, missingIndices: number[] } => {
  const chars = word.split('');
  const missingIndices: number[] = [];
  
  // Mask approx 30-50% of letters
  const numToMask = Math.max(1, Math.floor(word.length * 0.4));
  
  while (missingIndices.length < numToMask) {
    const idx = Math.floor(Math.random() * word.length);
    if (!missingIndices.includes(idx)) {
      missingIndices.push(idx);
    }
  }

  const display = chars.map((char, i) => missingIndices.includes(i) ? '_' : char).join(' ');
  return { display, missingIndices };
};