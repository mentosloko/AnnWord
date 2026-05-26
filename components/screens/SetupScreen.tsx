import React, { useMemo } from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, WordLength } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';
import { PlayableModeRoute } from '../AppScreens';
import { getWordsMissingTranslations } from '../../services/translationCoverage';

interface SetupScreenProps {
  selectedPlayMode: PlayableModeRoute;
  settings: GameSettings;
  customDictionaryWords: string[];
  setupError: string | null;
  isUploadingDictionary: boolean;
  isAuthenticated: boolean;
  onSettingsChange: (settings: GameSettings) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onStartGame: () => void;
  onBack: () => void;
  onLogin: () => void;
}

const WORD_LENGTHS: WordLength[] = [4, 5, 6];
const DIFFICULTIES: DifficultyLevel[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'];

const MODE_LABELS: Record<PlayableModeRoute, string> = {
  game: 'Wordle',
  anagrams: 'Анаграммы',
  sprint: 'Спринт',
  memory: 'Мемо',
  hangman: 'Виселица',
};

export const SetupScreen: React.FC<SetupScreenProps> = ({
  selectedPlayMode,
  settings,
  customDictionaryWords,
  setupError,
  isUploadingDictionary,
  isAuthenticated,
  onSettingsChange,
  onFileUpload,
  onStartGame,
  onBack,
  onLogin,
}) => {
  const isWordleMode = selectedPlayMode === 'game';
  const isCustomDictionary = settings.dictionarySource === 'custom';
  const customWordsCount = customDictionaryWords.length;
  const missingTranslationWords = useMemo(
    () => getWordsMissingTranslations(customDictionaryWords),
    [customDictionaryWords],
  );
  const canStart = !isCustomDictionary || customWordsCount > 0;

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const selectDictionarySource = (source: DictionarySource) => {
    if (source === 'custom' && !isAuthenticated) {
      onLogin();
      return;
    }
    updateSetting('dictionarySource', source);
  };

  return (
    <ScreenContainer className="max-w-3xl px-3 pb-20 pt-3 sm:px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          aria-label="Назад"
          title="Назад"
        >
          ←
        </button>
        <div className="min-w-0 text-center">
          <div className="text-xs font-black uppercase tracking-widest text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div>
          <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Настройка игры</h1>
        </div>
        <div className="h-11 w-11" />
      </div>

      <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
        {setupError && (
          <div className="mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {setupError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {isWordleMode && (
            <section>
              <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Длина слова</h2>
              <div className="grid grid-cols-3 gap-2">
                {WORD_LENGTHS.map(length => (
                  <button
                    type="button"
                    key={length}
                    onClick={() => updateSetting('wordLength', length)}
                    className={`rounded-2xl py-3 font-black transition ${
                      settings.wordLength === length
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border-2 border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    {length}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Словарь</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['builtin', 'custom'] as DictionarySource[]).map(source => {
                const isSelected = settings.dictionarySource === source;
                const isCustom = source === 'custom';
                return (
                  <button
                    type="button"
                    key={source}
                    onClick={() => selectDictionarySource(source)}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-950'
                        : 'border-indigo-100 bg-white text-gray-700 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="mb-1 text-xl">{isCustom ? '🧩' : '📚'}</div>
                    <div className="text-sm font-black">{isCustom ? 'Мой словарь' : 'Встроенный'}</div>
                    <div className="mt-1 text-[11px] font-bold text-gray-400">
                      {isCustom
                        ? isAuthenticated
                          ? `${customWordsCount} слов`
                          : 'нужен аккаунт'
                        : 'уровни сложности'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {!isCustomDictionary && (
            <section>
              <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Уровень</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {DIFFICULTIES.map(level => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => updateSetting('difficulty', level)}
                    className={`rounded-2xl py-2.5 text-sm font-black transition ${
                      settings.difficulty === level
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border-2 border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isCustomDictionary && (
            <section className="rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/50 p-4">
              {!isAuthenticated ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="font-black text-indigo-950">Войдите в аккаунт</div>
                    <div className="text-xs font-bold text-gray-500">Так можно загрузить свой TXT/CSV словарь.</div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogin}
                    className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700"
                  >
                    Войти
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-center">
                  <input type="file" accept=".txt,.csv" onChange={onFileUpload} className="hidden" />
                  <span className="text-2xl">📄</span>
                  <span className="flex-1">
                    <span className="block font-black text-indigo-950">
                      {customWordsCount > 0 ? 'Обновить словарь' : 'Загрузить словарь'}
                    </span>
                    <span className="block text-xs font-bold text-gray-500">TXT/CSV: слова через пробел, строку или запятую.</span>
                  </span>
                  <span className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-bold text-indigo-700">
                    {isUploadingDictionary ? 'Загрузка...' : 'Выбрать файл'}
                  </span>
                </label>
              )}
            </section>
          )}

          {isCustomDictionary && customWordsCount > 0 && (
            <section className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-4">
              <div className="mb-2 text-sm font-black text-amber-800">
                Слова без перевода: {missingTranslationWords.length}
              </div>
              {missingTranslationWords.length > 0 ? (
                <div className="max-h-28 overflow-auto rounded-xl bg-white/70 p-2 text-xs font-bold text-amber-900">
                  {missingTranslationWords.join(', ')}
                </div>
              ) : (
                <div className="text-xs font-bold text-amber-700">Для всех слов найден перевод во встроенном словаре.</div>
              )}
            </section>
          )}
        </div>

        <button
          type="button"
          onClick={onStartGame}
          disabled={!canStart}
          className={`mt-5 w-full rounded-2xl py-4 font-black transition shadow-lg ${
            canStart
              ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
              : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
          }`}
        >
          {canStart ? `Играть: ${MODE_LABELS[selectedPlayMode]}` : 'Сначала загрузите словарь'}
        </button>
      </div>
    </ScreenContainer>
  );
};