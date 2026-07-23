import React from 'react';
import { DailyQuestState, DictionarySource, GameSettings, UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { useDictionaryPools } from '../../hooks/useDictionaryPools';
import { QuestContextBanner } from '../QuestContextBanner';
import { ScreenContainer } from '../layout/ScreenContainer';
import { FloatingNotice } from '../ui/StatusNotice';
import { ExperienceState, experienceUi } from '../ui/ExperiencePrimitives';
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
  autoStart?: boolean;
  onAutoStartComplete?: () => void;
}

const MODE_LABELS: Record<PlayableModeRoute, string> = { game: 'Классика', anagrams: 'Анаграммы', translation: '1 из 2', sprint: 'Спринт', memory: 'Память', hangman: 'Виселица', letter_square: 'Змейка' };

export const SetupScreen: React.FC<SetupScreenProps> = ({ selectedPlayMode, settings, customDictionaryWords, setupError, isUploadingDictionary, isAuthenticated, userProfile, questContext, hasActiveClassicGame = false, onResumeClassicGame, onOpenDictionaryStudio, onOpenPremium, onSettingsChange, onStartGame, onBack, onLogin, autoStart = false, onAutoStartComplete }) => {
  const parentMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = settings.dictionarySource;
  const dictionaryRuntime = useDictionaryPools({ settings, userProfile, enabled: true });
  const [isStarting, setIsStarting] = React.useState(false);
  const autoStartedRef = React.useRef(false);
  const assignedCount = parentMode ? (userProfile.assignedWords || []).length : 0;
  const sourceReady = source !== 'custom' || (hasPremium && customDictionaryWords.length > 0);
  const premiumCatalog = parentMode ? getKidsDictionaryCatalog() : getPremiumDictionaryCatalog();

  const selectSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && !isAuthenticated) { onLogin(); return; }
    if ((nextSource === 'custom' || nextSource === 'premium') && !hasPremium) { onOpenPremium(); return; }
    const nextPremiumId = nextSource === 'premium' && !settings.activePremiumDictionaryId && premiumCatalog[0]?.id ? premiumCatalog[0].id : settings.activePremiumDictionaryId;
    onSettingsChange({ ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom', activePremiumDictionaryId: nextPremiumId });
  };
  const startGame = React.useCallback(async () => {
    if (!sourceReady || isStarting) return;
    setIsStarting(true);
    try { await dictionaryRuntime.ensureReady(); await onStartGame(); }
    catch { /* The hook exposes the user-facing error. */ }
    finally { setIsStarting(false); }
  }, [dictionaryRuntime, isStarting, onStartGame, sourceReady]);

  React.useEffect(() => {
    if (!autoStart) { autoStartedRef.current = false; return; }
    if (autoStartedRef.current || !sourceReady) return;
    autoStartedRef.current = true;
    void startGame().finally(() => onAutoStartComplete?.());
  }, [autoStart, onAutoStartComplete, sourceReady, startGame]);

  const retryDictionaryLoad = async () => { try { await dictionaryRuntime.ensureReady(); } catch { /* The hook exposes the user-facing error. */ } };
  const loadingLabel = dictionaryRuntime.status === 'error' ? 'Повторить загрузку словаря' : isStarting || dictionaryRuntime.status === 'loading' ? 'Загружаю словарь…' : `${hasActiveClassicGame && selectedPlayMode === 'game' ? 'Начать новую: ' : 'Начать: '}${MODE_LABELS[selectedPlayMode]}${questContext ? ' · задание' : ''}`;
  const visibleError = setupError || (dictionaryRuntime.error ? 'Не удалось загрузить словарь. Проверьте соединение и повторите.' : null);

  if (autoStart) return <ScreenContainer className="max-w-md pb-24 pt-12"><ExperienceState kind={visibleError ? 'error' : 'loading'} title={visibleError ? 'Не удалось подготовить игру' : `Готовим «${MODE_LABELS[selectedPlayMode]}»`} description={visibleError || 'Загружаем выбранный словарь. Игра начнётся автоматически.'} actionLabel={visibleError ? 'Открыть настройки' : undefined} onAction={visibleError ? onAutoStartComplete : undefined} /><button type="button" onClick={onBack} className={`mt-3 w-full ${experienceUi.secondaryButton}`}>Отменить</button></ScreenContainer>;

  return <ScreenContainer className="max-w-3xl px-3 pb-24 pt-3 sm:px-4 sm:pb-20">
    <FloatingNotice message={visibleError} tone="error" role="alert" />
    <div className="mb-3 flex items-center justify-between gap-3"><button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-indigo-700 ring-1 ring-indigo-100">←</button><div className="min-w-0 text-center"><div className="truncate text-xs font-bold uppercase tracking-wider text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div><h1 className="text-2xl font-bold text-indigo-950 sm:text-3xl">Настройки игры</h1></div><div className="h-11 w-11" /></div>
    {questContext && <div className="mb-4"><QuestContextBanner quest={questContext} /></div>}
    <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-indigo-100 sm:p-6">
      <section aria-labelledby="dictionary-source-title"><h2 id="dictionary-source-title" className={experienceUi.eyebrow}>Слова для игры</h2><div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Источник слов">
        <button type="button" aria-pressed={source === 'builtin'} onClick={() => selectSource('builtin')} className={`min-w-0 rounded-2xl p-3 text-left ring-2 ${source === 'builtin' ? 'bg-indigo-50 ring-indigo-300' : 'ring-indigo-50'}`}><div className="text-xl" aria-hidden="true">{parentMode && assignedCount ? '🎓' : parentMode ? '🌈' : '📚'}</div><div className="mt-1 truncate text-sm font-bold">{parentMode && assignedCount ? 'От учителя' : parentMode ? 'Детский' : 'База'}</div><div className="truncate text-[11px] font-medium text-slate-400">{parentMode && assignedCount ? `${assignedCount} слов` : parentMode ? 'бесплатно' : 'по уровню'}</div></button>
        <button type="button" aria-pressed={source === 'custom' && hasPremium} onClick={() => selectSource('custom')} className={`relative min-w-0 rounded-2xl p-3 text-left ring-2 ${source === 'custom' && hasPremium ? 'bg-purple-50 ring-purple-300' : 'ring-indigo-50'}`}><span className="absolute right-2 top-2 text-xs" aria-hidden="true">{hasPremium ? '✨' : '🔒'}</span><div className="text-xl" aria-hidden="true">🧩</div><div className="mt-1 truncate text-sm font-bold">Свои слова</div><div className="truncate text-[11px] font-medium text-slate-400">{hasPremium ? (customDictionaryWords.length ? 'готово' : 'пусто') : 'Premium'}</div></button>
        <button type="button" aria-pressed={source === 'premium' && hasPremium} onClick={() => selectSource('premium')} className={`relative min-w-0 rounded-2xl p-3 text-left ring-2 ${source === 'premium' && hasPremium ? 'bg-amber-50 ring-amber-300' : 'ring-indigo-50'}`}><span className="absolute right-2 top-2 text-xs" aria-hidden="true">{hasPremium ? '✓' : '🔒'}</span><div className="text-xl" aria-hidden="true">✨</div><div className="mt-1 truncate text-sm font-bold">Темы</div><div className="truncate text-[11px] font-medium text-slate-400">Premium</div></button>
      </div></section>
      {source === 'builtin' && parentMode && assignedCount > 0 && hasPremium && <section className="mt-4 rounded-2xl bg-indigo-50 p-4"><div className="font-bold text-indigo-950">Назначено преподавателем: {assignedCount} слов</div><p className="mt-1 text-xs font-medium text-indigo-600">Эти слова будут использоваться в играх вместо общего детского набора.</p></section>}
      {!hasPremium && <button type="button" onClick={onOpenPremium} className="mt-4 w-full rounded-2xl bg-amber-50 px-4 py-3 text-left ring-1 ring-amber-100"><span className="block text-sm font-bold text-amber-900">Нужны свои слова?</span><span className="mt-1 block text-xs font-medium leading-relaxed text-amber-800/80">В Premium можно выбрать тему или добавить слова из школы, курса или работы.</span></button>}
      {source === 'custom' && hasPremium && <section className="mt-4 rounded-2xl bg-purple-50/70 p-4"><span className="block font-bold text-indigo-950">{customDictionaryWords.length ? `Выбрано слов: ${customDictionaryWords.length}` : 'Список слов пока пуст'}</span><p className="mt-1 text-xs font-medium text-purple-700/80">{customDictionaryWords.length ? 'Список готов для игр.' : 'Добавьте слова, чтобы начать.'}</p>{isUploadingDictionary && <p className="mt-2 text-xs font-bold text-purple-700">Сохраняю слова…</p>}<button type="button" onClick={onOpenDictionaryStudio} className={`mt-3 w-full ${experienceUi.primaryButton}`}>{customDictionaryWords.length ? 'Изменить слова' : 'Добавить слова'}</button></section>}
      {source === 'premium' && hasPremium && <section className="mt-4 rounded-2xl bg-amber-50/70 p-4"><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">Выберите тему</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Выбор Premium-словаря">{premiumCatalog.map(item => <button type="button" key={item.id} onClick={() => onSettingsChange({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: item.id })} className={`rounded-2xl bg-white p-3 text-left ring-2 ${settings.activePremiumDictionaryId === item.id ? 'ring-amber-300' : 'ring-transparent'}`}><div className="text-xl" aria-hidden="true">{item.icon}</div><div className="mt-1 truncate text-xs font-bold text-indigo-950">{item.shortTitle}</div></button>)}</div></section>}
      {hasActiveClassicGame && selectedPlayMode === 'game' && onResumeClassicGame && <button type="button" onClick={onResumeClassicGame} className="mt-5 w-full rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-700 ring-1 ring-emerald-100">Продолжить сохранённую игру</button>}
      <button type="button" onClick={() => void (dictionaryRuntime.status === 'error' ? retryDictionaryLoad() : startGame())} disabled={!sourceReady || isStarting || dictionaryRuntime.status === 'loading'} className={`mt-3 w-full py-4 ${sourceReady && dictionaryRuntime.status !== 'loading' ? experienceUi.primaryButton : 'rounded-2xl bg-slate-100 font-bold text-slate-400'}`}>{!sourceReady ? source === 'custom' && !hasPremium ? 'Нужен Premium' : 'Нет слов для игры' : loadingLabel}</button>
    </div>
  </ScreenContainer>;
};
