import { useCallback, useState, type ChangeEvent } from 'react';
import { DictionaryImportDiagnostics, readDictionaryFile } from '../services/dictionaryUpload';
import type { DictionarySource } from '../types';

interface UseDictionaryUploadArgs {
  updateDictionary: (dictionary: string[]) => Promise<void>;
  setDictionarySource?: (source: DictionarySource) => void;
}

export const useDictionaryUpload = ({ updateDictionary }: UseDictionaryUploadArgs) => {
  const [isUploadingDictionary, setIsUploadingDictionary] = useState(false);
  const [dictionaryUploadError, setDictionaryUploadError] = useState<string | null>(null);
  const [dictionaryUploadWarnings, setDictionaryUploadWarnings] = useState<string[]>([]);
  const [lastImportDiagnostics, setLastImportDiagnostics] = useState<DictionaryImportDiagnostics | null>(null);

  const handleDictionaryFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingDictionary(true);
    setDictionaryUploadError(null);
    setDictionaryUploadWarnings([]);

    readDictionaryFile(file)
      .then(async result => {
        if (result.words.length === 0) {
          setDictionaryUploadError('В файле не найдено ни одного английского слова.');
          setLastImportDiagnostics(result.diagnostics);
          return;
        }

        await updateDictionary(result.words);
        // Importing changes the contents of "Свой", but activation is a separate
        // canonical selection action and must not happen as a local side effect.
        setDictionaryUploadWarnings(result.warnings);
        setLastImportDiagnostics(result.diagnostics);
      })
      .catch(error => {
        setDictionaryUploadError(error?.message || 'Не удалось загрузить словарь.');
      })
      .finally(() => {
        setIsUploadingDictionary(false);
        event.target.value = '';
      });
  }, [updateDictionary]);

  return {
    isUploadingDictionary,
    dictionaryUploadError,
    dictionaryUploadWarnings,
    lastImportDiagnostics,
    handleDictionaryFileUpload,
  };
};
