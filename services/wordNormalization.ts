export const normalizeWord = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z]/g, '');

export const hasRussianTranslation = (translation: string | undefined | null): boolean =>
  Boolean(translation && /[А-Яа-яЁё]/.test(translation));

export const normalizeCustomDictionary = (words: string[] = []): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const word of words) {
    const clean = normalizeWord(word);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }
  return normalized;
};
