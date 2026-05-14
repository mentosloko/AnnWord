import { useCallback, useState } from 'react';
import { DictionaryImportDiagnostics, readDictionaryFile } from '../services/dictionaryUpload';
import { DictionarySource } from '../types';

interface UseDictionaryUploadArgs {
  updateDictionary: (dictionary: string[]) => Promise<void>;
  setDictionarySource: (source: DictionarySource) => void;
}

export const useDictionaryUpload = ({ updateDictionary, setDictionarySource }: UseDictionaryUploadArgs) => {
  const [isUploadingDictionary, setIsUploadingDictionary] = useState(false);
  const [dictionaryUploadError, setDictionaryUploadError] = useState<string | null>(null);
  const [dictionaryUploadWarnings, setDictionaryUploadWarnings] = useState<string[]>([]);
  const [lastImportDiagnostics, setLastImportDiagnostics] = useState<DictionaryImportDiagnostics | null>(null);

  const handleDictionaryFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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
        setDictionarySource('custom');
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
  }, [setDictionarySource, updateDictionary]);

  return {
    isUploadingDictionary,
    dictionaryUploadError,
    dictionaryUploadWarnings,
    lastImportDiagnostics,
    handleDictionaryFileUpload,
  };
};
