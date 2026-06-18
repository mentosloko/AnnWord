import React from 'react';
import { DictionarySource, GameSettings, UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { ScreenContainer } from '../layout/ScreenContainer';
import { PlayableModeRoute } from '../AppScreens';

interface SetupScreenProps {
  selectedPlayMode: PlayableModeRoute;
  settings: GameSettings;
  customDictionaryWords: string[];
  setupError: string | null;
  isUploadingDictionary: boolean;
  isAuthenticated: boolean;
  userProfile: UserProfile;
  onSettingsChange: (settings: GameSettings) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenDictionaryStudio: () => void;
  onOpenPremium: () => void;
  onStartGame: () => void;
  onBack: () => void;
  onLogin: () => void;
}

const MODE_LABELS: Record<PlayableModeRoute, string> = {
  game: 'Классика',
  anagrams: 'Анаграммы',
  translation: '1 из 2',
  sprint: 'Спринт',
  memory: 'Память',
  hangman: 'Виселица',
  letter_square: 'Квадрат слов',
};

export const SetupScreen: React.FC<SetupScreenProps> = ({
  selectedPlayMode,
  settings,
  customDictionaryWords,
  setupError,
  isUploadingDictionary,
  isAuthenticated,
  userProfile,
  onOpenDictionaryStudio,
  onOpenPremium,
  onSettingsChange,
  onStartGame,
  onBack,
  onLogin,
}) => {
  const parentMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = settings.dictionarySource;
  const canStart = source !== 'custom' || (hasPremium && customDictionaryWords.length > 0);

  const selectSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && !isAuthenticated) {
      onLogin();
      return;
    }
    if ((nextSource === 'custom' || nextSource === 'premium') && !hasPremium) {
      onOpenPremium();
      return;
    }
    onSettingsChange({ ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom' });
  };

  return <ScreenContainer className="max-w-3xl px-3 pb-20 pt-3 sm:px-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div>
        <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Перед стартом</h1>
      </div>
      <div className="h-11 w-11" />
    </div>

    <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
      {setupError && <div role="alert" aria-live="assertive" className="mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{setupError}</div>}

      <section className="mt-2" aria-labelledby="dictionary-source-title">
        <h2 id="dictionary-source-title" className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Слова для игры</h2>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Источник слов">
          <button type="button" aria-pressed={source === 'builtin'} onClick={() => selectSource('builtin')} className={`rounded-2xl border-2 p-3 text-left ${source === 'builtin' ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-100'}`}>
            <div className="text-xl" aria-hidden="true">{parentMode ? '🌈' : '📚'}</div>
            <div className="text-sm font-black">{parentMode ? 'Детский' : 'Встроенный'}</div>
            <div className="text-[11px] font-bold text-gray-400">{parentMode ? 'бесплатно' : 'по уровням'}</div>
          </button>
          <button type="button" aria-pressed={source === 'custom' && hasPremium} onClick={() => selectSource('custom')} className={`relative rounded-2xl border-2 p-3 text-left ${source === 'custom' && hasPremium ? 'border-purple-300 bg-purple-50' : 'border-indigo-100'}`}>
            <span className="absolute right-3 top-3 text-sm" aria-hidden="true">{hasPremium ? '✨' : '🔒'}</span>
            <div className="text-xl" aria-hidden="true">🧩</div>
            <div className="text-sm font-black">Мой словарь</div>
            <div className="text-[11px] font-bold text-gray-400">{hasPremium ? `${customDictionaryWords.length} слов` : 'Premium'}</div>
          </button>
          <button type="button" aria-pressed={source === 'premium' && hasPremium} onClick={() => selectSource('premium')} className={`relative rounded-2xl border-2 p-3 text-left ${source === 'premium' && hasPremium ? 'border-amber-300 bg-amber-50' : 'border-indigo-100'}`}>
            <span className="absolute right-3 top-3 text-sm" aria-hidden="true">{hasPremium ? '✅' : '🔒'}</span>
            <div className="text-xl" aria-hidden="true">✨</div>
            <div className="text-sm font-black">Premium</div>
            <div className="text-[11px] font-bold text-gray-400">{parentMode ? 'детские наборы' : 'подборки'}</div>
          </button>
        </div>
      </section>

      {source === 'custom' && hasPremium && <section className="mt-4 rounded-2xl border-2 border-dashed border-purple-100 bg-purple-50/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="block font-black text-indigo-950">{customDictionaryWords.length ? 'Словарь готов к игре' : 'Создайте словарь'}</span>
            <span className="block text-xs font-bold text-gray-500">Загрузка и распознавание — в студии словарей</span>
          </div>
          <button type="button" onClick={onOpenDictionaryStudio} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white">Открыть студию</button>
        </div>
        {isUploadingDictionary && <p className="mt-2 text-xs font-bold text-purple-700">Сохраняю словарь...</p>}
      </section>}

      <button type="button" onClick={onStartGame} disabled={!canStart} className={`mt-5 w-full rounded-2xl py-4 font-black ${canStart ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
        {canStart ? `Начать: ${MODE_LABELS[selectedPlayMode]}` : source === 'custom' && !hasPremium ? 'Нужен Premium' : 'Нет слов для игры'}
      </button>
    </div>
  </ScreenContainer>;
};
