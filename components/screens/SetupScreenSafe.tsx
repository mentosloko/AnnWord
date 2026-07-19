import React from 'react';
import { DailyQuestState, DictionarySource, GameSettings, UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { useDictionaryPools } from '../../hooks/useDictionaryPools';
import { QuestContextBanner } from '../QuestContextBanner';
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
  questContext?: DailyQuestState | null;
  hasActiveClassicGame?: boolean;
  onResumeClassicGame?: () => boolean;
  onSettingsChange: (settings: GameSettings) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenDictionaryStudio: () => void;
  onOpenPremium: () => void;
  onStartGame: () => void | Promise<void>;
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
  letter_square: 'Змейка',
};

export const SetupScreen: React.FC<SetupScreenProps> = ({
  selectedPlayMode,
  settings,
  customDictionaryWords,
  setupError,
  isUploadingDictionary,
  isAuthenticated,
  userProfile,
  questContext,
  hasActiveClassicGame = false,
  onResumeClassicGame,
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
  const dictionaryRuntime = useDictionaryPools({ settings, userProfile, enabled: true });
  const [isStarting, setIsStarting] = React.useState(false);
  const sourceReady = source !== 'custom' || (hasPremium && customDictionaryWords.length > 0);
  const canStart = sourceReady && dictionaryRuntime.status === 'ready' && !isStarting;
  const premiumCatalog = parentMode ? getKidsDictionaryCatalog() : getPremiumDictionaryCatalog();

  const selectSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && !isAuthenticated) {
      onLogin();
      return;
    }
    if ((nextSource === 'custom' || nextSource === 'premium') && !hasPremium) {
      onOpenPremium();
      return;
    }
    const nextPremiumId = nextSource === 'premium' && !settings.activePremiumDictionaryId && premiumCatalog[0]?.id ? premiumCatalog[0].id : settings.activePremiumDictionaryId;
    onSettingsChange({ ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom', activePremiumDictionaryId: nextPremiumId });
  };

  const startGame = async () => {
    if (!sourceReady || isStarting) return;
    setIsStarting(true);
    try {
      await dictionaryRuntime.ensureReady();
      await onStartGame();
    } finally {
      setIsStarting(false);
    }
  };

  const loadingLabel = dictionaryRuntime.status === 'error'
    ? 'Повторить загрузку словаря'
    : isStarting || dictionaryRuntime.status === 'loading'
      ? 'Загружаю словарь…'
      : `${hasActiveClassicGame && selectedPlayMode === 'game' ? 'Начать новую: ' : 'Начать: '}${MODE_LABELS[selectedPlayMode]}${questContext ? ' · задание' : ''}`;

  return <ScreenContainer className="max-w-3xl px-3 pb-20 pt-3 sm:px-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="min-w-0 text-center">
        <div className="truncate text-xs font-black uppercase tracking-widest text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div>
        <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Перед стартом</h1>
      </div>
      <div className="h-11 w-11" />
    </div>

    {questContext && <div className="mb-4"><QuestContextBanner quest={questContext} /></div>}

    <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
      {setupError && <div role="alert" aria-live="assertive" className="mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{setupError}</div>}
      {dictionaryRuntime.error && <div role="alert" aria-live="assertive" className="mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Не удалось загрузить словарь. Проверьте соединение и повторите.</div>}

      <section className="mt-2" aria-labelledby="dictionary-source-title">
        <h2 id="dictionary-source-title" className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Слова для игры</h2>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Источник слов">
          <button type="button" aria-pressed={source === 'builtin'} onClick={() => selectSource('builtin')} className={`min-w-0 rounded-2xl border-2 p-2 text-left sm:p-3 ${source === 'builtin' ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-100'}`}>
            <div className="text-lg sm:text-xl" aria-hidden="true">{parentMode ? '🌈' : '📚'}</div>
            <div className="truncate text-xs font-black sm:text-sm">{parentMode ? 'Детский' : 'База'}</div>
            <div className="truncate text-[10px] font-bold text-gray-400 sm:text-[11px]">{parentMode ? 'бесплатно' : 'уровни'}</div>
          </button>
          <button type="button" aria-pressed={source === 'custom' && hasPremium} onClick={() => selectSource('custom')} className={`relative min-w-0 rounded-2xl border-2 p-2 text-left sm:p-3 ${source === 'custom' && hasPremium ? 'border-purple-300 bg-purple-50' : 'border-indigo-100'}`}>
            <span className="absolute right-2 top-2 text-xs sm:right-3 sm:top-3 sm:text-sm" aria-hidden="true">{hasPremium ? '✨' : '🔒'}</span>
            <div className="text-lg sm:text-xl" aria-hidden="true">🧩</div>
            <div className="truncate text-xs font-black sm:text-sm">Свои слова</div>
            <div className="truncate text-[10px] font-bold text-gray-400 sm:text-[11px]">{hasPremium ? (customDictionaryWords.length ? 'готово' : 'добавьте слова') : 'Premium'}</div>
          </button>
          <button type="button" aria-pressed={source === 'premium' && hasPremium} onClick={() => selectSource('premium')} className={`relative min-w-0 rounded-2xl border-2 p-2 text-left sm:p-3 ${source === 'premium' && hasPremium ? 'border-amber-300 bg-amber-50' : 'border-indigo-100'}`}>
            <span className="absolute right-2 top-2 text-xs sm:right-3 sm:top-3 sm:text-sm" aria-hidden="true">{hasPremium ? '✅' : '🔒'}</span>
            <div className="text-lg sm:text-xl" aria-hidden="true">✨</div>
            <div className="truncate text-xs font-black sm:text-sm">Premium</div>
            <div className="truncate text-[10px] font-bold text-gray-400 sm:text-[11px]">темы</div>
          </button>
        </div>
      </section>

      {!hasPremium && <button type="button" onClick={onOpenPremium} className="mt-4 w-full rounded-2xl border-2 border-amber-100 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100/70">
        <span className="block text-sm font-black text-amber-900">👑 Хотите сыграть по нужным словам?</span>
        <span className="mt-1 block text-xs font-bold leading-relaxed text-amber-800/80">В Premium можно выбрать тему или добавить слова из школы, курса, учебника или работы.</span>
      </button>}

      {source === 'custom' && hasPremium && <section className="mt-4 rounded-2xl border-2 border-dashed border-purple-100 bg-purple-50/50 p-4">
        <span className="block font-black text-indigo-950">{customDictionaryWords.length ? 'Слова из вашего списка выбраны' : 'Список слов пока пуст'}</span>
        <p className="mt-1 text-xs font-bold text-purple-700/80">{customDictionaryWords.length ? 'Список готов для игр.' : 'Добавьте слова, чтобы начать игру по своему списку.'}</p>
        {isUploadingDictionary && <p className="mt-2 text-xs font-bold text-purple-700">Сохраняю слова...</p>}
        <button type="button" onClick={onOpenDictionaryStudio} className="mt-3 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-black text-white transition hover:bg-purple-700">{customDictionaryWords.length ? 'Изменить свои слова' : 'Добавить свои слова'}</button>
      </section>}

      {source === 'premium' && hasPremium && <section className="mt-4 rounded-2xl border-2 border-dashed border-amber-100 bg-amber-50/60 p-4">
        <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-amber-500">{parentMode ? 'Выберите детскую тему' : 'Выберите тему Premium'}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Выбор Premium-словаря">
          {premiumCatalog.map(item => <button type="button" key={item.id} onClick={() => onSettingsChange({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: item.id })} className={`rounded-2xl border-2 bg-white/75 p-3 text-left transition hover:bg-white ${settings.activePremiumDictionaryId === item.id ? 'border-amber-300 shadow-sm' : 'border-white'}`}>
            <div className="text-xl" aria-hidden="true">{item.icon}</div>
            <div className="mt-1 truncate text-xs font-black text-indigo-950">{item.shortTitle}</div>
          </button>)}
        </div>
      </section>}

      {hasActiveClassicGame && selectedPlayMode === 'game' && onResumeClassicGame && <button type="button" onClick={onResumeClassicGame} className="mt-5 w-full rounded-2xl border-2 border-green-100 bg-green-50 py-3 font-black text-green-700">
        Продолжить сохранённую игру
      </button>}
      <button type="button" onClick={() => void (dictionaryRuntime.status === 'error' ? dictionaryRuntime.ensureReady() : startGame())} disabled={!sourceReady || isStarting || dictionaryRuntime.status === 'loading'} className={`mt-3 w-full rounded-2xl py-4 font-black ${sourceReady && dictionaryRuntime.status !== 'loading' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
        {!sourceReady ? source === 'custom' && !hasPremium ? 'Нужен Premium' : 'Нет слов для игры' : loadingLabel}
      </button>
    </div>
  </ScreenContainer>;
};
