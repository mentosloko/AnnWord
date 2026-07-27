import React from 'react';
import { DailyQuestState, DictionarySource, GameSettings, UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import {
  getSpotlightGrades,
  getSpotlightSections,
  SPOTLIGHT_ALL_SECTIONS_ID,
  SPOTLIGHT_PREMIUM_DICTIONARY_ID,
  type SpotlightGradeNumber,
} from '../../services/spotlightDictionary';
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
  onStartGame: (dictionarySnapshot?: string[]) => void | Promise<void>;
  onBack: () => void;
  onLogin: () => void;
  autoStart?: boolean;
  onAutoStartComplete?: () => void;
}

const MODE_LABELS: Record<PlayableModeRoute, string> = { game: 'Классика', anagrams: 'Анаграммы', translation: '1 из 2', sprint: 'Спринт', memory: 'Память', hangman: 'Виселица', letter_square: 'Змейка' };
const LENGTH_AGNOSTIC_MODES = new Set<PlayableModeRoute>(['anagrams', 'translation', 'sprint', 'memory', 'letter_square']);
const DICTIONARY_START_TIMEOUT_MS = 10_000;
const SPOTLIGHT_STORAGE_PREFIX = 'annword_spotlight_selection_v1:';

const waitForDictionaryRuntime = async (promise: Promise<void>): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Словарь загружается слишком долго. Проверьте соединение и повторите.')), DICTIONARY_START_TIMEOUT_MS);
  });
  try { await Promise.race([promise, timeout]); }
  finally { if (timeoutId !== null) clearTimeout(timeoutId); }
};

const readStoredSpotlightSelection = (username: string): { grade: SpotlightGradeNumber; sectionId: string } => {
  if (typeof window === 'undefined') return { grade: 2, sectionId: SPOTLIGHT_ALL_SECTIONS_ID };
  try {
    const raw = window.localStorage.getItem(`${SPOTLIGHT_STORAGE_PREFIX}${username || 'guest'}`);
    const parsed = raw ? JSON.parse(raw) as { grade?: unknown; sectionId?: unknown } : null;
    const grade = getSpotlightGrades().includes(parsed?.grade as SpotlightGradeNumber) ? parsed?.grade as SpotlightGradeNumber : 2;
    const sectionId = typeof parsed?.sectionId === 'string' && parsed.sectionId ? parsed.sectionId : SPOTLIGHT_ALL_SECTIONS_ID;
    return { grade, sectionId };
  } catch {
    return { grade: 2, sectionId: SPOTLIGHT_ALL_SECTIONS_ID };
  }
};

const storeSpotlightSelection = (username: string, grade: number, sectionId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SPOTLIGHT_STORAGE_PREFIX}${username || 'guest'}`, JSON.stringify({ grade, sectionId }));
  } catch {
    // Local preference persistence must not block dictionary selection.
  }
};

export const SetupScreen: React.FC<SetupScreenProps> = ({ selectedPlayMode, settings, customDictionaryWords, setupError, isUploadingDictionary, isAuthenticated, userProfile, questContext, hasActiveClassicGame = false, onResumeClassicGame, onOpenDictionaryStudio, onOpenPremium, onSettingsChange, onStartGame, onBack, onLogin, autoStart = false, onAutoStartComplete }) => {
  const parentMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = settings.dictionarySource;
  const dictionaryRuntime = useDictionaryPools({ settings, userProfile, enabled: true });
  const [isStarting, setIsStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const autoStartedRef = React.useRef(false);
  const assignedCount = parentMode ? (userProfile.assignedWords || []).length : 0;
  const premiumSourceWithoutAccess = source !== 'builtin' && !hasPremium;
  const sourceReady = source === 'builtin' || (source === 'premium' && hasPremium) || (source === 'custom' && hasPremium && customDictionaryWords.length > 0);
  const practicePremiumCatalog = getPremiumDictionaryCatalog();
  const spotlightMeta = practicePremiumCatalog.find(item => item.id === SPOTLIGHT_PREMIUM_DICTIONARY_ID);
  const premiumCatalog = parentMode
    ? [...(spotlightMeta ? [spotlightMeta] : []), ...getKidsDictionaryCatalog()]
    : practicePremiumCatalog;
  const spotlightActive = source === 'premium' && settings.activePremiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID;
  const spotlightGrade = (getSpotlightGrades().includes(settings.activeSpotlightGrade as SpotlightGradeNumber) ? settings.activeSpotlightGrade : 2) as SpotlightGradeNumber;
  const spotlightSectionId = settings.activeSpotlightSectionId || SPOTLIGHT_ALL_SECTIONS_ID;
  const spotlightSections = spotlightActive ? getSpotlightSections(spotlightGrade) : [];
  const respectWordLength = !LENGTH_AGNOSTIC_MODES.has(selectedPlayMode);
  const readModeWords = React.useCallback(() => dictionaryRuntime.getModeWords({ respectWordLength }), [dictionaryRuntime, respectWordLength]);
  const immediateWordCount = readModeWords().length;
  const dictionaryLoadBlocksStart = dictionaryRuntime.status === 'loading' && immediateWordCount === 0;

  React.useEffect(() => {
    setStartError(null);
  }, [selectedPlayMode, settings.activePremiumDictionaryId, settings.activeSpotlightGrade, settings.activeSpotlightSectionId, settings.dictionarySource, settings.difficulty, settings.wordLength]);

  React.useEffect(() => {
    if (autoStart || !premiumSourceWithoutAccess) return;
    onSettingsChange({ ...settings, dictionarySource: 'builtin', useCustomDictionary: false });
  }, [autoStart, onSettingsChange, premiumSourceWithoutAccess, settings]);

  React.useEffect(() => {
    if (!spotlightActive || (settings.activeSpotlightGrade && settings.activeSpotlightSectionId)) return;
    const stored = readStoredSpotlightSelection(userProfile.username);
    onSettingsChange({
      ...settings,
      activeSpotlightGrade: settings.activeSpotlightGrade || stored.grade,
      activeSpotlightSectionId: settings.activeSpotlightSectionId || stored.sectionId,
    });
  }, [onSettingsChange, settings, spotlightActive, userProfile.username]);

  const selectSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && !isAuthenticated) { onLogin(); return; }
    if ((nextSource === 'custom' || nextSource === 'premium') && !hasPremium) { onOpenPremium(); return; }
    const nextPremiumId = nextSource === 'premium' && !settings.activePremiumDictionaryId && premiumCatalog[0]?.id ? premiumCatalog[0].id : settings.activePremiumDictionaryId;
    const nextSettings: GameSettings = { ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom', activePremiumDictionaryId: nextPremiumId };
    if (nextPremiumId === SPOTLIGHT_PREMIUM_DICTIONARY_ID && (!nextSettings.activeSpotlightGrade || !nextSettings.activeSpotlightSectionId)) {
      const stored = readStoredSpotlightSelection(userProfile.username);
      nextSettings.activeSpotlightGrade = stored.grade;
      nextSettings.activeSpotlightSectionId = stored.sectionId;
    }
    onSettingsChange(nextSettings);
  };

  const selectPremiumDictionary = (id: string) => {
    if (id !== SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
      onSettingsChange({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: id });
      return;
    }
    const stored = readStoredSpotlightSelection(userProfile.username);
    onSettingsChange({
      ...settings,
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: id,
      activeSpotlightGrade: settings.activeSpotlightGrade || stored.grade,
      activeSpotlightSectionId: settings.activeSpotlightSectionId || stored.sectionId,
    });
  };

  const selectSpotlightGrade = (grade: SpotlightGradeNumber) => {
    storeSpotlightSelection(userProfile.username, grade, SPOTLIGHT_ALL_SECTIONS_ID);
    onSettingsChange({ ...settings, activeSpotlightGrade: grade, activeSpotlightSectionId: SPOTLIGHT_ALL_SECTIONS_ID });
  };

  const selectSpotlightSection = (sectionId: string) => {
    storeSpotlightSelection(userProfile.username, spotlightGrade, sectionId);
    onSettingsChange({ ...settings, activeSpotlightGrade: spotlightGrade, activeSpotlightSectionId: sectionId });
  };

  const startGame = React.useCallback(async () => {
    if (!sourceReady || isStarting) return;
    setIsStarting(true);
    setStartError(null);
    try {
      let dictionarySnapshot = readModeWords();
      if (!dictionarySnapshot.length) {
        await waitForDictionaryRuntime(dictionaryRuntime.ensureReady());
        dictionarySnapshot = readModeWords();
      } else if (dictionaryRuntime.status !== 'ready') {
        void dictionaryRuntime.ensureReady().catch(() => undefined);
      }
      if (!dictionarySnapshot.length) throw new Error('В выбранном словаре нет слов для этой игры.');
      await onStartGame(dictionarySnapshot);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Не удалось подготовить игру. Попробуйте снова.');
    }
    finally { setIsStarting(false); }
  }, [dictionaryRuntime, isStarting, onStartGame, readModeWords, sourceReady]);

  React.useEffect(() => {
    if (!autoStart) { autoStartedRef.current = false; return; }
    if (autoStartedRef.current) return;
    if (premiumSourceWithoutAccess) {
      onSettingsChange({ ...settings, dictionarySource: 'builtin', useCustomDictionary: false });
      return;
    }
    if (!sourceReady) {
      autoStartedRef.current = true;
      setStartError(source === 'custom' ? 'В выбранном списке пока нет слов. Добавьте слова или выберите встроенный словарь.' : 'Выбранный словарь сейчас недоступен.');
      onAutoStartComplete?.();
      return;
    }
    autoStartedRef.current = true;
    void startGame().finally(() => onAutoStartComplete?.());
  }, [autoStart, onAutoStartComplete, onSettingsChange, premiumSourceWithoutAccess, settings, source, sourceReady, startGame]);

  const retryDictionaryLoad = async () => { try { await waitForDictionaryRuntime(dictionaryRuntime.ensureReady()); setStartError(null); } catch (error) { setStartError(error instanceof Error ? error.message : 'Не удалось загрузить словарь.'); } };
  const loadingLabel = dictionaryRuntime.status === 'error' ? 'Повторить загрузку словаря' : isStarting || dictionaryLoadBlocksStart ? 'Загружаю словарь…' : `${hasActiveClassicGame && selectedPlayMode === 'game' ? 'Начать новую: ' : 'Начать: '}${MODE_LABELS[selectedPlayMode]}${questContext ? ' · задание' : ''}`;
  const visibleError = setupError || startError || (dictionaryRuntime.error ? 'Не удалось загрузить словарь. Проверьте соединение и повторите.' : null);

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
      {source === 'premium' && hasPremium && <section className="mt-4 rounded-2xl bg-amber-50/70 p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">Выберите словарь</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Выбор Premium-словаря">{premiumCatalog.map(item => <button type="button" key={item.id} onClick={() => selectPremiumDictionary(item.id)} className={`rounded-2xl bg-white p-3 text-left ring-2 ${settings.activePremiumDictionaryId === item.id ? 'ring-amber-300' : 'ring-transparent'}`}><div className="text-xl" aria-hidden="true">{item.icon}</div><div className="mt-1 truncate text-xs font-bold text-indigo-950">{item.shortTitle}</div></button>)}</div>
        {spotlightActive && <div className="mt-4 rounded-2xl bg-white/80 p-3 ring-1 ring-amber-100">
          <h3 className="text-sm font-bold text-indigo-950">Класс</h3>
          <div className="mt-2 grid grid-cols-5 gap-2" role="group" aria-label="Класс Spotlight">{getSpotlightGrades().map(grade => <button type="button" key={grade} onClick={() => selectSpotlightGrade(grade)} className={`rounded-xl px-2 py-2 text-sm font-bold ring-2 ${spotlightGrade === grade ? 'bg-amber-100 text-amber-900 ring-amber-300' : 'bg-white text-indigo-700 ring-indigo-50'}`}>{grade}</button>)}</div>
          <h3 className="mt-4 text-sm font-bold text-indigo-950">Раздел</h3>
          {dictionaryRuntime.status === 'loading' && spotlightSections.length === 0 ? <p className="mt-2 text-xs font-medium text-amber-700">Загружаю модули…</p> : <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Раздел Spotlight">
            <button type="button" onClick={() => selectSpotlightSection(SPOTLIGHT_ALL_SECTIONS_ID)} className={`rounded-xl p-3 text-left ring-2 ${spotlightSectionId === SPOTLIGHT_ALL_SECTIONS_ID ? 'bg-amber-100 ring-amber-300' : 'bg-white ring-indigo-50'}`}><span className="block text-sm font-bold text-indigo-950">Весь класс</span><span className="mt-1 block text-[11px] font-medium text-slate-500">Все модули и дополнительные слова</span></button>
            {spotlightSections.map(section => <button type="button" key={section.id} onClick={() => selectSpotlightSection(section.id)} className={`rounded-xl p-3 text-left ring-2 ${spotlightSectionId === section.id ? 'bg-amber-100 ring-amber-300' : 'bg-white ring-indigo-50'}`}><span className="block text-sm font-bold text-indigo-950">{section.label}</span><span className="mt-1 block line-clamp-2 text-[11px] font-medium text-slate-500">{section.title} · {section.wordCount} слов</span></button>)}
          </div>}
          {dictionaryRuntime.status === 'ready' && <p className="mt-3 text-xs font-bold text-emerald-700">Выбрано для текущей игры: {immediateWordCount} слов</p>}
        </div>}
      </section>}
      {hasActiveClassicGame && selectedPlayMode === 'game' && onResumeClassicGame && <button type="button" onClick={onResumeClassicGame} className="mt-5 w-full rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-700 ring-1 ring-emerald-100">Продолжить сохранённую игру</button>}
      <button type="button" onClick={() => void (dictionaryRuntime.status === 'error' ? retryDictionaryLoad() : startGame())} disabled={!sourceReady || isStarting || dictionaryLoadBlocksStart} className={`mt-3 w-full py-4 ${sourceReady && !dictionaryLoadBlocksStart ? experienceUi.primaryButton : 'rounded-2xl bg-slate-100 font-bold text-slate-400'}`}>{!sourceReady ? source === 'custom' && !hasPremium ? 'Нужен Premium' : 'Нет слов для игры' : loadingLabel}</button>
    </div>
  </ScreenContainer>;
};
