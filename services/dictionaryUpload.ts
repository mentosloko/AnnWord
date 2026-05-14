export interface DictionaryImportDiagnostics {
  rawTokenCount: number;
  normalizedTokenCount: number;
  importedCount: number;
  duplicateCount: number;
  emptyAfterNormalizationCount: number;
  invalidTokenCount: number;
}

export interface DictionaryImportResult {
  words: string[];
  diagnostics: DictionaryImportDiagnostics;
  warnings: string[];
}

const TOKEN_SPLIT_PATTERN = /[\n\s,;]+/;
const LETTER_PATTERN = /^[A-Z]+$/;

export const normalizeDictionaryToken = (token: string): string =>
  token.trim().toUpperCase().replace(/[^A-Z]/g, '');

export const parseDictionaryText = (text: string): DictionaryImportResult => {
  const rawTokens = text.split(TOKEN_SPLIT_PATTERN).map(token => token.trim());
  const seen = new Set<string>();
  const words: string[] = [];
  let duplicateCount = 0;
  let emptyAfterNormalizationCount = 0;
  let invalidTokenCount = 0;
  let normalizedTokenCount = 0;

  for (const rawToken of rawTokens) {
    if (!rawToken) continue;

    if (!LETTER_PATTERN.test(rawToken.toUpperCase())) {
      invalidTokenCount += 1;
    }

    const normalized = normalizeDictionaryToken(rawToken);
    if (!normalized) {
      emptyAfterNormalizationCount += 1;
      continue;
    }

    normalizedTokenCount += 1;

    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(normalized);
    words.push(normalized);
  }

  const warnings: string[] = [];
  if (duplicateCount > 0) warnings.push(`Удалены дубликаты: ${duplicateCount}.`);
  if (invalidTokenCount > 0) warnings.push(`Очищены токены с неанглийскими символами: ${invalidTokenCount}.`);
  if (words.length === 0) warnings.push('Не найдено ни одного английского слова для импорта.');

  return {
    words,
    warnings,
    diagnostics: {
      rawTokenCount: rawTokens.filter(Boolean).length,
      normalizedTokenCount,
      importedCount: words.length,
      duplicateCount,
      emptyAfterNormalizationCount,
      invalidTokenCount,
    },
  };
};

export const readDictionaryFile = (file: File): Promise<DictionaryImportResult> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = readerEvent => {
    try {
      resolve(parseDictionaryText(String(readerEvent.target?.result || '')));
    } catch (error) {
      reject(error);
    }
  };
  reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл словаря.'));
  reader.readAsText(file);
});
