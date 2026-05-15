import React from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, WordLength } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface SetupScreenProps {
  settings: GameSettings;
  customWordsCount: number;
  setupError: string | null;
  isUploadingDictionary: boolean;
  onSettingsChange: (settings: GameSettings) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onStartGame: () => void;
  onBack: () => void;
}

const WORD_LENGTHS: WordLength[] = [4, 5, 6];
const DIFFICULTIES: DifficultyLevel[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'];

export const SetupScreen: React.FC<SetupScreenProps> = ({
  settings,
  customWordsCount,
  setupError,
  isUploadingDictionary,
  onSettingsChange,
  onFileUpload,
  onStartGame,
  onBack,
}) => {
  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <ScreenContainer className="max-w-4xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
      >
        ← На главный экран
      </button>

      <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-6 sm:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-indigo-950 mb-2">Настройка игры</h1>
          <p className="text-gray-500">Выберите длину слова, уровень и источник словаря перед стартом.</p>
        </div>

        {setupError && (
          <div className="mb-6 rounded-2xl bg-red-50 border-2 border-red-100 px-4 py-3 text-red-700 font-bold">
            {setupError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-3">Длина слова</h2>
            <div className="grid grid-cols-3 gap-2">
              {WORD_LENGTHS.map(length => (
                <button
                  type="button"
                  key={length}
                  onClick={() => updateSetting('wordLength', length)}
                  className={`rounded-2xl py-3 font-black border-2 transition ${
                    settings.wordLength === length
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-indigo-100 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {length}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-3">Уровень</h2>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(level => (
                <button
                  type="button"
                  key={level}
                  onClick={() => updateSetting('difficulty', level)}
                  className={`rounded-2xl py-3 font-black border-2 transition ${
                    settings.difficulty === level
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-indigo-100 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2">
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-3">Словарь</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['builtin', 'custom'] as DictionarySource[]).map(source => (
                <button
                  type="button"
                  key={source}
                  onClick={() => updateSetting('dictionarySource', source)}
                  className={`rounded-3xl p-5 text-left border-2 transition ${
                    settings.dictionarySource === source
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                      : 'bg-white border-indigo-100 text-gray-700 hover:bg-indigo-50'
                  }`}
                >
                  <div className="text-2xl mb-2">{source === 'builtin' ? '📚' : '⬆️'}</div>
                  <div className="font-black mb-1">{source === 'builtin' ? 'Встроенный словарь' : 'Мой словарь'}</div>
                  <div className="text-xs text-gray-500">
                    {source === 'builtin'
                      ? 'Базовый словарь с уровнями сложности.'
                      : `${customWordsCount} слов загружено.`}
                  </div>
                </button>
              ))}
            </div>

            <label className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 cursor-pointer hover:bg-indigo-50 transition">
              <input type="file" accept=".txt,.csv" onChange={onFileUpload} className="hidden" />
              <span className="text-2xl">📄</span>
              <span className="flex-1">
                <span className="block font-black text-indigo-900">Загрузить словарь</span>
                <span className="block text-xs text-gray-500">TXT/CSV, слова через пробел, перенос строки или запятую.</span>
              </span>
              <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-indigo-700 border border-indigo-100">
                {isUploadingDictionary ? 'Загрузка...' : 'Выбрать файл'}
              </span>
            </label>
          </section>
        </div>

        <button
          type="button"
          onClick={onStartGame}
          className="mt-8 w-full rounded-2xl bg-indigo-600 py-4 text-white font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
        >
          Начать игру
        </button>
      </div>
    </ScreenContainer>
  );
};
