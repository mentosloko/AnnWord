const APOSTROPHE_VARIANTS = /[‘’ʼ`´]/g;
const DASH_VARIANTS = /[‐‑‒–—―−]/g;
const ENGLISH_WORD_PATTERN = /[A-Za-z]+(?:['-][A-Za-z]+)*/g;

const normalizePunctuation = (value: string): string => value
  .normalize('NFKC')
  .replace(APOSTROPHE_VARIANTS, "'")
  .replace(DASH_VARIANTS, '-');

/**
 * Extracts English words from arbitrary pasted text.
 * Separators, bullets, numbering, Cyrillic text and other characters are ignored.
 */
export const tokenizeEnglishWords = (value: string): string[] => (
  normalizePunctuation(value).match(ENGLISH_WORD_PATTERN) || []
).map(word => word.toUpperCase());

/**
 * Produces a stable, case-insensitive list while preserving the first occurrence order.
 */
export const parseEnglishWordList = (value: string): string[] => Array.from(
  new Set(tokenizeEnglishWords(value)),
);

/**
 * Applies the same parser to values received as an array, including accidentally pasted phrases.
 */
export const normalizeEnglishWordArray = (values: readonly string[]): string[] =>
  parseEnglishWordList(values.join('\n'));

export const formatEnglishWordList = (value: string): string =>
  parseEnglishWordList(value).join('\n');

export const analyzeEnglishWordList = (value: string) => {
  const tokens = tokenizeEnglishWords(value);
  const words = Array.from(new Set(tokens));
  return {
    words,
    hasDuplicates: tokens.length !== words.length,
    outsideLength: words.filter(word => word.length < 4 || word.length > 6),
  };
};
