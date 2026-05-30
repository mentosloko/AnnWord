import React from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, WordLength } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';
import { PlayableModeRoute } from '../AppScreens';

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
const DIFFICULTIES: Array<{ value: DifficultyLevel; label: string; short: string }> = [
  { value: 'ALL', label: 'Все слова', short: 'Все' },
  { value: 'A1', label: 'Начальный · A1', short: 'A1' },
  { value: 'A2', label: 'Базовый · A2', short: 'A2' },
  { value: 'B1', label: 'Средний · B1', short: 'B1' },
  { value: 'B2', label: 'Продвинутый · B2', short: 'B2' },
  { value: 'C1', label: 'Сложный · C1', short: 'C1' },
];

const MODE_LABELS: Record<PlayableModeRoute, string> = {
  game: 'Классика',
  anagrams: 'Анаграммы',
  sprint: 'Спринт',
  memory: 'Память',
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
        <button type="button" onClick={onBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50" aria-label="Назад" title="Назад">←</button>
        <div className="min-w-0 text-center">
          <div className="text-xs font-black uppercase tracking-widest text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div>
          <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Перед стартом</h1>
        </div>
        <div className="h-11 w-11" />
      </div>

      <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
        {setupError && <div className="mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{setupError}</div>}

        <div className="grid grid-cols-1 gap-4">
          {isWordleMode && (
            <section>
              <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Длина слова</h2>
              <div className="grid grid-cols-3 gap-2">
                {WORD_LENGTHS.map(length => (
                  <button type="button" key={length} onClick={() => updateSetting('wordLength', length)} className={`rounded-2xl py-3 font-black transition ${settings.wordLength === length ? 'bg-indigo-600 text-white shadow-sm' : 'border-2 border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50'}`}>{length}</button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Слова для игры</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => selectDictionarySource('builtin')} className={`rounded-2xl border-2 p-3 text-left transition ${!isCustomDictionary ? 'border-indigo-300 bg-indigo-50 text-indigo-950' : 'border-indigo-100 bg-white text-gray-700 hover:bg-indigo-50'}`}>
                <div className="mb-1 text-xl">📚</div><div className="text-sm font-black">Встроенный</div><div className="mt-1 text-[11px] font-bold text-gray-400">по уровням сложности</div>
              </button>
              <button type="button" onClick={() => selectDictionarySource('custom')} className={`relative rounded-2xl border-2 p-3 text-left transition ${isCustomDictionary ? 'border-indigo-300 bg-indigo-50 text-indigo-950' : 'border-indigo-100 bg-white text-gray-700 hover:bg-indigo-50'}`}>
                {!isAuthenticated && <span className="absolute right-3 top-3 text-sm">🔒</span>}
                <div className="mb-1 text-xl">🧩</div><div className="text-sm font-black">Мой словарь</div><div className="mt-1 text-[11px] font-bold text-gray-400">{isAuthenticated ? `${customWordsCount} слов` : 'после входа'}</div>
              </button>
            </div>
          </section>

          {!isCustomDictionary && (
            <section>
              <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Сложность</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {DIFFICULTIES.map(level => (
                  <button type="button" key={level.value} title={level.label} aria-label={level.label} onClick={() => updateSetting('difficulty', level.value)} className={`rounded-2xl px-1 py-2.5 text-sm font-black transition ${settings.difficulty === level.value ? 'bg-indigo-600 text-white shadow-sm' : 'border-2 border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50'}`}>{level.short}</button>
                ))}
              </div>
              <div className="mt-2 text-xs font-bold text-gray-400">A1 — проще, C1 — сложнее</div>
            </section>
          )}

          {isCustomDictionary && (
            <section className="rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/50 p-4">
              {!isAuthenticated ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1"><div className="font-black text-indigo-950">Войдите, чтобы загрузить словарь</div><div className="text-xs font-bold text-gray-500">Личные слова сохранятся в профиле.</div></div>
                  <button type="button" onClick={onLogin} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700">Войти</button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-center">
                  <input type="file" accept=".txt,.csv" onChange={onFileUpload} className="hidden" />
                  <span className="text-2xl">📄</span>
                  <span className="flex-1"><span className="block font-black text-indigo-950">{customWordsCount > 0 ? 'Обновить словарь' : 'Загрузить словарь'}</span><span className="block text-xs font-bold text-gray-500">TXT или CSV · слова через строку или запятую</span></span>
                  <span className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-bold text-indigo-700">{isUploadingDictionary ? 'Загрузка...' : 'Выбрать файл'}</span>
                </label>
              )}
            </section>
          )}
        </div>

        <button type="button" onClick={onStartGame} disabled={!canStart} className={`mt-5 w-full rounded-2xl py-4 font-black shadow-lg transition ${canStart ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'}`}>
          {canStart ? `Начать: ${MODE_LABELS[selectedPlayMode]}` : 'Загрузите словарь для игры'}
        </button>
      </div>
    </ScreenContainer>
  );
};