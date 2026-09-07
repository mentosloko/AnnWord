import React from 'react';
import { DailyQuestState, DictionarySource, GameSettings, UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import {
  canonicalizeSpotlightSectionIds,
  getSpotlightGrades,
  getSpotlightSections,
  getSpotlightSelectionLabel,
  readStoredSpotlightSelection,
  SPOTLIGHT_ALL_SECTIONS_ID,
  SPOTLIGHT_PREMIUM_DICTIONARY_ID,
  storeSpotlightSelection,
  toggleSpotlightSectionSelection,
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
  onCommitDictionarySettings: (settings: GameSettings) => Promise<void>;
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

const waitForDictionaryRuntime = async (promise: Promise<void>): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Не удалось загрузить словарь. Проверьте интернет и попробуйте ещё раз.')), DICTIONARY_START_TIMEOUT_MS);
  });
  try { await Promise.race([promise, timeout]); }
  finally { if (timeoutId !== null) clearTimeout(timeoutId); }
};

const legacySectionId = (sectionIds: string[]): string =>
  sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID) ? SPOTLIGHT_ALL_SECTIONS_ID : sectionIds[0] || SPOTLIGHT_ALL_SECTIONS_ID;

export const SetupScreen: React.FC<SetupScreenProps> = ({ selectedPlayMode, settings, customDictionaryWords, setupError, isUploadingDictionary, isAuthenticated, userProfile, questContext, hasActiveClassicGame = false, onResumeClassicGame, onCommitDictionarySettings, onOpenDictionaryStudio, onOpenPremium, onStartGame, onBack, onLogin, autoStart = false, onAutoStartComplete }) => {
  const parentMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = settings.dictionarySource;
  const dictionaryRuntime = useDictionaryPools({ settings, userProfile, enabled: true });
  const [isStarting, setIsStarting] = React.useState(false);
  const [isSavingSource, setIsSavingSource] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const autoStartedRef = React.useRef(false);
  const assignedCount = parentMode ? (userProfile.assignedWords || []).length : 0;
  const premiumSourceWithoutAccess = source !== 'builtin' && !hasPremium;
  const sourceConfigured = source === 'builtin' || (source === 'premium' && hasPremium) || (source === 'custom' && hasPremium && customDictionaryWords.length > 0);
  const practicePremiumCatalog = getPremiumDictionaryCatalog();
  const spotlightMeta = practicePremiumCatalog.find(item => item.id === SPOTLIGHT_PREMIUM_DICTIONARY_ID);
  const premiumCatalog = parentMode
    ? [...(spotlightMeta ? [spotlightMeta] : []), ...getKidsDictionaryCatalog()]
    : practicePremiumCatalog;
  const storedSpotlight = readStoredSpotlightSelection(userProfile.username);
  const spotlightActive = source === 'premium' && settings.activePremiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID;
  const spotlightGrade = (getSpotlightGrades().includes(settings.activeSpotlightGrade as SpotlightGradeNumber) ? settings.activeSpotlightGrade : storedSpotlight.grade) as SpotlightGradeNumber;
  const configuredSpotlightSectionIds = settings.activeSpotlightSectionIds?.length
    ? settings.activeSpotlightSectionIds
    : settings.activeSpotlightSectionId
      ? [settings.activeSpotlightSectionId]
      : storedSpotlight.sectionIds;
  const spotlightSectionIds = canonicalizeSpotlightSectionIds(spotlightGrade, configuredSpotlightSectionIds);
  const spotlightSectionIdSet = new Set(spotlightSectionIds);
  const allSpotlightSectionsSelected = spotlightSectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID);
  const spotlightSections = spotlightActive ? getSpotlightSections(spotlightGrade) : [];
  const respectWordLength = !LENGTH_AGNOSTIC_MODES.has(selectedPlayMode);
  const readModeWords = React.useCallback(() => dictionaryRuntime.getModeWords({ respectWordLength }), [dictionaryRuntime, respectWordLength]);
  const immediateWordCount = readModeWords().length;
  const customModeUnavailable = source === 'custom' && hasPremium && customDictionaryWords.length > 0 && dictionaryRuntime.status === 'ready' && immediateWordCount === 0;
  const sourceReady = sourceConfigured && !customModeUnavailable;
  const dictionaryLoadBlocksStart = dictionaryRuntime.status === 'loading' && immediateWordCount === 0;
  const customAvailabilityLabel = !customDictionaryWords.length
    ? 'пусто'
    : dictionaryRuntime.status === 'loading'
      ? 'проверяю'
      : immediateWordCount > 0
        ? 'можно играть'
        : 'нет слов для режима';
  const customAvailabilityText = !customDictionaryWords.length
    ? 'Добавьте слова, чтобы начать.'
    : dictionaryRuntime.status === 'loading'
      ? 'Проверяем, какие слова подходят для выбранной игры.'
      : immediateWordCount > 0
        ? `Для «${MODE_LABELS[selectedPlayMode]}» доступно слов: ${immediateWordCount}.`
        : `Список сохранён, но для «${MODE_LABELS[selectedPlayMode]}» пока нет доступных слов с русским переводом${respectWordLength ? ` длиной ${settings.wordLength}` : ''}.`;

  React.useEffect(() => {
    setStartError(null);
  }, [selectedPlayMode, settings.activePremiumDictionaryId, settings.activeSpotlightGrade, settings.activeSpotlightSectionId, settings.activeSpotlightSectionIds?.join(','), settings.dictionarySource, settings.difficulty, settings.wordLength]);

  const commitSourceSettings = React.useCallback(async (nextSettings: GameSettings): Promise<boolean> => {
    if (isSavingSource) return false;
    setIsSavingSource(true);
    setStartError(null);
    try {
      await onCommitDictionarySettings(nextSettings);
      return true;
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Не удалось сохранить выбор словаря. Попробуйте ещё раз.');
      return false;
    } finally {
      setIsSavingSource(false);
    }
  }, [isSavingSource, onCommitDictionarySettings]);

  const spotlightSettings = (grade: SpotlightGradeNumber, sectionIds: string[]): GameSettings => {
    const canonical = canonicalizeSpotlightSectionIds(grade, sectionIds);
    return {
      ...settings,
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionIds: canonical,
      activeSpotlightSectionId: legacySectionId(canonical),
    };
  };

  const selectSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && !isAuthenticated) { onLogin(); return; }
    if ((nextSource === 'custom' || nextSource === 'premium') && !hasPremium) { onOpenPremium(); return; }
    const nextPremiumId = nextSource === 'premium' && !settings.activePremiumDictionaryId && premiumCatalog[0]?.id ? premiumCatalog[0].id : settings.activePremiumDictionaryId;
    const nextSettings: GameSettings = { ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom', activePremiumDictionaryId: nextPremiumId };
    if (nextSource !== 'premium') {
      nextSettings.activePremiumDictionaryId = undefined;
      nextSettings.activeSpotlightGrade = undefined;
      nextSettings.activeSpotlightSectionId = undefined;
      nextSettings.activeSpotlightSectionIds = undefined;
    } else if (nextPremiumId === SPOTLIGHT_PREMIUM_DICTIONARY_ID && !nextSettings.activeSpotlightGrade) {
      nextSettings.activeSpotlightGrade = storedSpotlight.grade;
      nextSettings.activeSpotlightSectionIds = storedSpotlight.sectionIds;
      nextSettings.activeSpotlightSectionId = legacySectionId(storedSpotlight.sectionIds);
    }
    void commitSourceSettings(nextSettings);
  };

  const selectPremiumDictionary = (id: string) => {
    if (id !== SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
      void commitSourceSettings({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: id, activeSpotlightGrade: undefined, activeSpotlightSectionId: undefined, activeSpotlightSectionIds: undefined });
      return;
    }
    const grade = settings.activeSpotlightGrade || storedSpotlight.grade;
    const sectionIds = settings.activeSpotlightSectionIds?.length
      ? settings.activeSpotlightSectionIds
      : settings.activeSpotlightSectionId
        ? [settings.activeSpotlightSectionId]
        : storedSpotlight.sectionIds;
    void commitSourceSettings(spotlightSettings(grade as SpotlightGradeNumber, sectionIds));
  };

  const selectSpotlightGrade = (grade: SpotlightGradeNumber) => {
    const sectionIds = [SPOTLIGHT_ALL_SECTIONS_ID];
    void commitSourceSettings(spotlightSettings(grade, sectionIds))
      .then(saved => { if (saved) storeSpotlightSelection(userProfile.username, { grade, sectionIds }); });
  };

  const selectSpotlightSection = (sectionId: string) => {
    const sectionIds = toggleSpotlightSectionSelection(spotlightGrade, spotlightSectionIds, sectionId);
    void commitSourceSettings(spotlightSettings(spotlightGrade, sectionIds))
      .then(saved => { if (saved) storeSpotlightSelection(userProfile.username, { grade: spotlightGrade, sectionIds }); });
  };

  const startGame = React.useCallback(async () => {
    if (!sourceReady || isStarting || isSavingSource) return;
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
      if (!dictionarySnapshot.length) throw new Error('В выбранном словаре нет слов для этой игры. Выберите другой словарь или режим.');
      await onStartGame(dictionarySnapshot);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Не удалось подготовить игру. Попробуйте снова.');
    }
    finally { setIsStarting(false); }
  }, [dictionaryRuntime, isSavingSource, isStarting, onStartGame, readModeWords, sourceReady]);

  React.useEffect(() => {
    if (!autoStart) { autoStartedRef.current = false; return; }
    if (autoStartedRef.current) return;
    if (!sourceReady || premiumSourceWithoutAccess) {
      autoStartedRef.current = true;
      setStartError(source === 'custom' ? 'В выбранном списке пока нет слов, подходящих для этой игры. Измените список или выберите другой режим.' : 'Выбранный словарь сейчас недоступен.');
      onAutoStartComplete?.();
      return;
    }
    autoStartedRef.current = true;
    void startGame().finally(() => onAutoStartComplete?.());
  }, [autoStart, onAutoStartComplete, premiumSourceWithoutAccess, source, sourceReady, startGame]);

  const retryDictionaryLoad = async () => { try { await waitForDictionaryRuntime(dictionaryRuntime.ensureReady()); setStartError(null); } catch (error) { setStartError(error instanceof Error ? error.message : 'Не удалось загрузить словарь.'); } };
  const loadingLabel = isSavingSource ? 'Сохраняю словарь…' : dictionaryRuntime.status === 'error' ? 'Повторить загрузку словаря' : isStarting || dictionaryLoadBlocksStart ? 'Загружаю словарь…' : `${hasActiveClassicGame && selectedPlayMode === 'game' ? 'Начать новую: ' : 'Начать: '}${MODE_LABELS[selectedPlayMode]}${questContext ? ' · задание' : ''}`;
  const visibleError = setupError || startError || (dictionaryRuntime.error ? 'Не удалось загрузить словарь. Проверьте соединение и повторите.' : null);

  if (autoStart) return <ScreenContainer className="max-w-md pb-24 pt-12"><ExperienceState kind={visibleError ? 'error' : 'loading'} title={visibleError ? 'Не удалось подготовить игру' : `Готовим «${MODE_LABELS[selectedPlayMode]}»`} description={visibleError || 'Загружаем выбранный словарь. Игра начнётся автоматически.'} actionLabel={visibleError ? 'Открыть настройки' : undefined} onAction={visibleError ? onAutoStartComplete : undefined} /><button type="button" onClick={onBack} className={`mt-3 w-full ${experienceUi.secondaryButton}`}>Отменить</button></ScreenContainer>;

  return <ScreenContainer className="max-w-3xl px-3 pb-24 pt-3 sm:px-4 sm:pb-20">
    <FloatingNotice message={visibleError} tone="error" role="alert" />
    <div className="mb-3 flex items-center justify-between gap-3"><button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-indigo-700 ring-1 ring-indigo-100">←</button><div className="min-w-0 text-center"><div className="truncate text-xs font-bold uppercase tracking-wider text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div><h1 className="text-2xl font-bold text-indigo-950 sm:text-3xl">Настройки игры</h1></div><div className="h-11 w-11" /></div>
    {questContext && <div className="mb-4"><QuestContextBanner quest={questContext} /></div>}
    <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-indigo-100 sm:p-6">
      <section aria-labelledby="dictionary-source-title"><h2 id="dictionary-source-title" className={experienceUi.eyebrow}>Слова для игры</h2><div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Источник слов">
        <button type="button" disabled={isSavingSource} aria-pressed={source === 'builtin'} onClick={() => selectSource('builtin')} className={`min-w-0 rounded-2xl p-3 text-left ring-2 disabled:opacity-60 ${source === 'builtin' ? 'bg-indigo-50 ring-indigo-300' : 'ring-indigo-50'}`}><div className="text-xl" aria-hidden="true">{parentMode && assignedCount ? '🎓' : parentMode ? '🌈' : '📚'}</div><div className="mt-1 truncate text-sm font-bold">{parentMode && assignedCount ? 'От учителя' : parentMode ? 'Все уровни' : 'База'}</div><div className="truncate text-[11px] font-medium text-slate-400">{parentMode && assignedCount ? `${assignedCount} слов` : parentMode ? 'A1–C2' : 'по уровню'}</div></button>
        <button type="button" disabled={isSavingSource} aria-pressed={source === 'custom' && hasPremium} onClick={() => selectSource('custom')} className={`relative min-w-0 rounded-2xl p-3 text-left ring-2 disabled:opacity-60 ${source === 'custom' && hasPremium ? 'bg-purple-50 ring-purple-300' : 'ring-indigo-50'}`}><span className="absolute right-2 top-2 text-xs" aria-hidden="true">{hasPremium ? '✨' : '🔒'}</span><div className="text-xl" aria-hidden="true">🧩</div><div className="mt-1 truncate text-sm font-bold">Свои слова</div><div className="truncate text-[11px] font-medium text-slate-400">{hasPremium ? customAvailabilityLabel : 'Premium'}</div></button>
        <button type="button" disabled={isSavingSource} aria-pressed={source === 'premium' && hasPremium} onClick={() => selectSource('premium')} className={`relative min-w-0 rounded-2xl p-3 text-left ring-2 disabled:opacity-60 ${source === 'premium' && hasPremium ? 'bg-amber-50 ring-amber-300' : 'ring-indigo-50'}`}><span className="absolute right-2 top-2 text-xs" aria-hidden="true">{hasPremium ? '✓' : '🔒'}</span><div className="text-xl" aria-hidden="true">✨</div><div className="mt-1 truncate text-sm font-bold">Темы</div><div className="truncate text-[11px] font-medium text-slate-400">Premium</div></button>
      </div></section>
      {source === 'builtin' && parentMode && assignedCount > 0 && hasPremium && <section className="mt-4 rounded-2xl bg-indigo-50 p-4"><div className="font-bold text-indigo-950">Назначено преподавателем: {assignedCount} слов</div><p className="mt-1 text-xs font-medium text-indigo-600">Эти слова будут использоваться в играх вместо общего детского набора.</p></section>}
      {!hasPremium && <button type="button" onClick={onOpenPremium} className="mt-4 w-full rounded-2xl bg-amber-50 px-4 py-3 text-left ring-1 ring-amber-100"><span className="block text-sm font-bold text-amber-900">Нужны свои слова?</span><span className="mt-1 block text-xs font-medium leading-relaxed text-amber-800/80">В Premium можно выбрать тему или добавить слова из школы, курса или работы.</span></button>}
      {source === 'custom' && hasPremium && <section className="mt-4 rounded-2xl bg-purple-50/70 p-4"><span className="block font-bold text-indigo-950">{customDictionaryWords.length ? `Сохранено слов: ${customDictionaryWords.length}` : 'Список слов пока пуст'}</span><p className="mt-1 text-xs font-medium text-purple-700/80">{customAvailabilityText}</p>{isUploadingDictionary && <p className="mt-2 text-xs font-bold text-purple-700">Сохраняю слова…</p>}<button type="button" onClick={onOpenDictionaryStudio} className={`mt-3 w-full ${experienceUi.primaryButton}`}>{customDictionaryWords.length ? 'Изменить слова' : 'Добавить слова'}</button></section>}
      {source === 'premium' && hasPremium && <section className="mt-4 rounded-2xl bg-amber-50/70 p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">Выберите словарь</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Выбор Premium-словаря">{premiumCatalog.map(item => <button type="button" disabled={isSavingSource} key={item.id} onClick={() => selectPremiumDictionary(item.id)} className={`rounded-2xl bg-white p-3 text-left ring-2 disabled:opacity-60 ${settings.activePremiumDictionaryId === item.id ? 'ring-amber-300' : 'ring-transparent'}`}><div className="text-xl" aria-hidden="true">{item.icon}</div><div className="mt-1 truncate text-xs font-bold text-indigo-950">{item.shortTitle}</div></button>)}</div>
        {spotlightActive && <div className="mt-4 rounded-2xl bg-white/80 p-3 ring-1 ring-amber-100">
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">{getSpotlightSelectionLabel(spotlightGrade, spotlightSectionIds)}</div>
          <h3 className="mt-3 text-sm font-bold text-indigo-950">Класс</h3>
          <div className="mt-2 grid grid-cols-5 gap-2" role="group" aria-label="Класс Spotlight">{getSpotlightGrades().map(grade => <button type="button" disabled={isSavingSource} key={grade} aria-pressed={spotlightGrade === grade} onClick={() => selectSpotlightGrade(grade)} className={`rounded-xl px-2 py-2 text-sm font-bold ring-2 disabled:opacity-60 ${spotlightGrade === grade ? 'bg-amber-100 text-amber-900 ring-amber-300' : 'bg-white text-indigo-700 ring-indigo-50'}`}>{grade}</button>)}</div>
          <h3 className="mt-4 text-sm font-bold text-indigo-950">Модули</h3>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Можно отметить несколько модулей одного класса. «Весь класс» отменяет отдельный выбор.</p>
          {dictionaryRuntime.status === 'loading' && spotlightSections.length === 0 ? <p className="mt-2 text-xs font-medium text-amber-700">Загружаю модули…</p> : <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Модули Spotlight">
            <button type="button" disabled={isSavingSource} aria-pressed={allSpotlightSectionsSelected} onClick={() => selectSpotlightSection(SPOTLIGHT_ALL_SECTIONS_ID)} className={`rounded-xl p-3 text-left ring-2 disabled:opacity-60 ${allSpotlightSectionsSelected ? 'bg-amber-100 ring-amber-300' : 'bg-white ring-indigo-50'}`}><span className="block text-sm font-bold text-indigo-950">Весь класс</span><span className="mt-1 block text-[11px] font-medium text-slate-500">Все модули и дополнительные слова</span></button>
            {spotlightSections.map(section => {
              const selected = spotlightSectionIdSet.has(section.id);
              return <button type="button" disabled={isSavingSource} key={section.id} aria-pressed={selected} onClick={() => selectSpotlightSection(section.id)} className={`rounded-xl p-3 text-left ring-2 disabled:opacity-60 ${selected ? 'bg-amber-100 ring-amber-300' : 'bg-white ring-indigo-50'}`}><span className="block text-sm font-bold text-indigo-950">{selected ? '✓ ' : ''}{section.label}</span><span className="mt-1 block line-clamp-2 text-[11px] font-medium text-slate-500">{section.title} · {section.wordCount} слов</span></button>;
            })}
          </div>}
          {dictionaryRuntime.status === 'ready' && <p className="mt-3 text-xs font-bold text-emerald-700">Выбрано для текущей игры: {immediateWordCount} слов</p>}
        </div>}
      </section>}
      {hasActiveClassicGame && selectedPlayMode === 'game' && onResumeClassicGame && <button type="button" onClick={onResumeClassicGame} className="mt-5 w-full rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-700 ring-1 ring-emerald-100">Продолжить сохранённую игру</button>}
      <button type="button" onClick={() => void (dictionaryRuntime.status === 'error' ? retryDictionaryLoad() : startGame())} disabled={!sourceReady || isStarting || isSavingSource || dictionaryLoadBlocksStart} className={`mt-3 w-full py-4 ${sourceReady && !dictionaryLoadBlocksStart ? experienceUi.primaryButton : 'rounded-2xl bg-slate-100 font-bold text-slate-400'}`}>{!sourceReady ? source === 'custom' && !hasPremium ? 'Нужен Premium' : source === 'custom' && customModeUnavailable ? `Нет слов для «${MODE_LABELS[selectedPlayMode]}»` : 'В этом наборе пока нет подходящих слов' : loadingLabel}</button>
    </div>
  </ScreenContainer>;
};
