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
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Finds the closest word in the dictionary to the input word.
 * Returns the closest word if distance <= threshold, else null.
 */
export const findClosestWord = (input: string, dictionary: string[], threshold: number = 1): string | null => {
  let closestWord = null;
  let minDistance = Infinity;

  const len = input.length;

  for (const word of dictionary) {
    if (Math.abs(word.length - len) > 2) continue;

    const dist = levenshteinDistance(input, word);

    if (dist < minDistance) {
      minDistance = dist;
      closestWord = word;
    }

    if (dist === 0) return word;
  }

  return minDistance <= threshold ? closestWord : null;
};

/**
 * Scrambles a word for the mini-game.
 * FIX: Cограничено число попыток, чтобы избежать бесконечной рекурсии для слов с повторяющимися буквами (LEVEL, TEETH и т.д.)
 */
export const scrambleWord = (word: string, attempts: number = 0): string => {
  if (attempts > 20) return word; // fallback: вернуть оригинал, если не удаётся перемешать
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  if (result === word && word.length > 1) return scrambleWord(word, attempts + 1);
  return result;
};

/**
 * Replaces random letters with underscores for "Gap Fill" game.
 */
export const createGapWord = (word: string): { display: string, missingIndices: number[] } => {
  const chars = word.split('');
  const missingIndices: number[] = [];

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
