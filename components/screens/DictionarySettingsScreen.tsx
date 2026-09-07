import React, { useEffect, useMemo, useState } from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, UserProfile } from '../../types';
import { activeWordSourceFromSettings, activeWordSourceKey } from '../../services/activeWordSource';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { isKidsMode } from '../../services/modeFlags';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import {
  canonicalizeSpotlightSectionIds,
  ensureSpotlightDictionaryLoaded,
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
import { formatRussianCount } from '../../utils/textUtils';
import { DifficultyPicker } from '../dictionary/DifficultyPicker';
import { ScreenContainer } from '../layout/ScreenContainer';
import { AccessibleDialog } from '../a11y/AccessibleDialog';

interface DictionarySettingsScreenProps {
  settings: GameSettings;
  userProfile: UserProfile;
  customDictionaryWords: string[];
  isAuthenticated: boolean;
  onCommitSettings: (settings: GameSettings) => Promise<void>;
  onOpenDictionaryStudio: () => void;
  onOpenPremium: () => void;
  onBack: () => void;
}

const SOURCE_OPTIONS: Array<{ source: DictionarySource; icon: string; title: string; note: string }> = [
  { source: 'builtin', icon: '📚', title: 'Все уровни', note: 'A1–C2' },
  { source: 'premium', icon: '✨', title: 'Темы', note: 'слова по теме' },
  { source: 'custom', icon: '🧩', title: 'Мой словарь', note: 'слова из вашего списка' },
];

const WORD_FORMS = ['слово', 'слова', 'слов'] as const;
const formatWordCount = (count: number): string => formatRussianCount(count, WORD_FORMS);
type SpotlightLoadState = 'idle' | 'loading' | 'ready' | 'error';
type MobileDictionaryStep = 'source' | 'difficulty' | 'premium' | 'spotlight_grade' | 'spotlight_section' | 'custom';

const legacySectionId = (sectionIds: string[]): string =>
  sectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID) ? SPOTLIGHT_ALL_SECTIONS_ID : sectionIds[0] || SPOTLIGHT_ALL_SECTIONS_ID;

export const DictionarySettingsScreen: React.FC<DictionarySettingsScreenProps> = ({
  settings,
  userProfile,
  customDictionaryWords,
  isAuthenticated,
  onCommitSettings,
  onOpenDictionaryStudio,
  onOpenPremium,
  onBack,
}) => {
  const [draftSettings, setDraftSettings] = useState<GameSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const kidsMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = draftSettings.dictionarySource;
  const practicePremiumCatalog = getPremiumDictionaryCatalog();
  const spotlightMeta = practicePremiumCatalog.find(item => item.id === SPOTLIGHT_PREMIUM_DICTIONARY_ID);
  const premiumCatalog = kidsMode
    ? [...(spotlightMeta ? [spotlightMeta] : []), ...getKidsDictionaryCatalog()]
    : practicePremiumCatalog;
  const selectedTopic = premiumCatalog.find(item => item.id === draftSettings.activePremiumDictionaryId) || premiumCatalog[0];
  const storedSpotlightSelection = useMemo(() => readStoredSpotlightSelection(userProfile.username), [userProfile.username]);
  const spotlightGrade = (getSpotlightGrades().includes(draftSettings.activeSpotlightGrade as SpotlightGradeNumber)
    ? draftSettings.activeSpotlightGrade
    : storedSpotlightSelection.grade) as SpotlightGradeNumber;
  const configuredSpotlightSectionIds = draftSettings.activeSpotlightSectionIds?.length
    ? draftSettings.activeSpotlightSectionIds
    : draftSettings.activeSpotlightSectionId
      ? [draftSettings.activeSpotlightSectionId]
      : storedSpotlightSelection.sectionIds;
  const spotlightActive = source === 'premium' && draftSettings.activePremiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID;
  const [spotlightLoadState, setSpotlightLoadState] = useState<SpotlightLoadState>('idle');
  const [spotlightRevision, setSpotlightRevision] = useState(0);
  const [mobileWizardOpen, setMobileWizardOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileDictionaryStep>('source');
  const spotlightSections = useMemo(() => getSpotlightSections(spotlightGrade), [spotlightGrade, spotlightRevision]);
  const selectedSpotlightSectionIds = canonicalizeSpotlightSectionIds(spotlightGrade, configuredSpotlightSectionIds);
  const selectedSpotlightSectionIdSet = new Set(selectedSpotlightSectionIds);
  const allSpotlightSectionsSelected = selectedSpotlightSectionIds.includes(SPOTLIGHT_ALL_SECTIONS_ID);
  const draftKey = activeWordSourceKey(activeWordSourceFromSettings(draftSettings));
  const activeKey = activeWordSourceKey(userProfile.activeWordSource);
  const dirty = draftKey !== activeKey;

  useEffect(() => {
    setDraftSettings(settings);
    setSaveError(null);
  }, [settings.dictionarySource, settings.difficulty, settings.activePremiumDictionaryId, settings.activeSpotlightGrade, settings.activeSpotlightSectionId, settings.activeSpotlightSectionIds?.join(',')]);

  useEffect(() => {
    if (!spotlightActive) return;
    let cancelled = false;
    setSpotlightLoadState('loading');
    void ensureSpotlightDictionaryLoaded()
      .then(() => {
        if (cancelled) return;
        setSpotlightRevision(value => value + 1);
        setSpotlightLoadState('ready');
      })
      .catch(() => { if (!cancelled) setSpotlightLoadState('error'); });
    return () => { cancelled = true; };
  }, [spotlightActive]);

  const leaveDictionarySettings = () => {
    if (typeof window !== 'undefined' && window.history.length > 1 && window.location.pathname === '/dictionary') {
      window.history.back();
      return;
    }
    onBack();
  };

  const applySpotlightSelection = (grade: SpotlightGradeNumber, sectionIds: string[]) => {
    const canonical = canonicalizeSpotlightSectionIds(grade, sectionIds);
    setDraftSettings(current => ({
      ...current,
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: SPOTLIGHT_PREMIUM_DICTIONARY_ID,
      activeSpotlightGrade: grade,
      activeSpotlightSectionIds: canonical,
      activeSpotlightSectionId: legacySectionId(canonical),
    }));
  };

  const chooseSource = (nextSource: DictionarySource) => {
    setSaveError(null);
    if ((nextSource === 'custom' || nextSource === 'premium') && (!isAuthenticated || !hasPremium)) {
      onOpenPremium();
      return;
    }
    const nextPremiumId = nextSource === 'premium'
      ? draftSettings.activePremiumDictionaryId || premiumCatalog[0]?.id
      : draftSettings.activePremiumDictionaryId;
    const nextSettings: GameSettings = {
      ...draftSettings,
      dictionarySource: nextSource,
      useCustomDictionary: nextSource === 'custom',
      activePremiumDictionaryId: nextPremiumId,
    };
    if (nextSource === 'premium' && nextPremiumId === SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
      nextSettings.activeSpotlightGrade = spotlightGrade;
      nextSettings.activeSpotlightSectionIds = selectedSpotlightSectionIds;
      nextSettings.activeSpotlightSectionId = legacySectionId(selectedSpotlightSectionIds);
    }
    setDraftSettings(nextSettings);
  };

  const selectPremiumDictionary = (id: string) => {
    setSaveError(null);
    if (id !== SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
      setDraftSettings({
        ...draftSettings,
        dictionarySource: 'premium',
        useCustomDictionary: false,
        activePremiumDictionaryId: id,
        activeSpotlightGrade: undefined,
        activeSpotlightSectionId: undefined,
        activeSpotlightSectionIds: undefined,
      });
      return;
    }
    applySpotlightSelection(spotlightGrade, selectedSpotlightSectionIds);
  };

  const selectSpotlightGrade = (grade: SpotlightGradeNumber) => {
    setSaveError(null);
    applySpotlightSelection(grade, [SPOTLIGHT_ALL_SECTIONS_ID]);
  };

  const selectSpotlightSection = (sectionId: string) => {
    setSaveError(null);
    const next = toggleSpotlightSectionSelection(spotlightGrade, selectedSpotlightSectionIds, sectionId);
    applySpotlightSelection(spotlightGrade, next);
  };

  const retrySpotlightLoad = () => {
    setSpotlightLoadState('loading');
    void ensureSpotlightDictionaryLoaded()
      .then(() => { setSpotlightRevision(value => value + 1); setSpotlightLoadState('ready'); })
      .catch(() => setSpotlightLoadState('error'));
  };

  const closeMobileWizard = () => { setMobileWizardOpen(false); setMobileStep('source'); };
  const chooseMobileSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && (!isAuthenticated || !hasPremium)) {
      closeMobileWizard();
      onOpenPremium();
      return;
    }
    chooseSource(nextSource);
    setMobileStep(nextSource === 'builtin' ? 'difficulty' : nextSource === 'premium' ? 'premium' : 'custom');
  };
  const chooseMobileDifficulty = (difficulty: DifficultyLevel) => {
    setDraftSettings({ ...draftSettings, dictionarySource: 'builtin', useCustomDictionary: false, difficulty });
    closeMobileWizard();
  };
  const chooseMobilePremium = (id: string) => {
    selectPremiumDictionary(id);
    if (id === SPOTLIGHT_PREMIUM_DICTIONARY_ID) setMobileStep('spotlight_grade');
    else closeMobileWizard();
  };
  const chooseMobileSpotlightGrade = (grade: SpotlightGradeNumber) => { selectSpotlightGrade(grade); setMobileStep('spotlight_section'); };

  const commit = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCommitSettings(draftSettings);
      if (draftSettings.dictionarySource === 'premium' && draftSettings.activePremiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID) {
        storeSpotlightSelection(userProfile.username, { grade: spotlightGrade, sectionIds: selectedSpotlightSectionIds });
      }
      leaveDictionarySettings();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить выбор словаря. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const currentLabel = source === 'custom'
    ? 'Ваш список'
    : source === 'premium'
      ? draftSettings.activePremiumDictionaryId === SPOTLIGHT_PREMIUM_DICTIONARY_ID
        ? `Школьные (Spotlight) · ${getSpotlightSelectionLabel(spotlightGrade, selectedSpotlightSectionIds)}`
        : selectedTopic?.title || 'Тематический словарь'
      : kidsMode
        ? draftSettings.difficulty === 'ALL' ? 'Все уровни' : draftSettings.difficulty
        : `General English · ${draftSettings.difficulty === 'ALL' ? 'все уровни' : draftSettings.difficulty}`;

  const spotlightModuleChooser = (mobile = false) => <>
    {spotlightLoadState === 'loading' && spotlightSections.length === 0 && <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">Загружаю список модулей…</p>}
    {spotlightLoadState === 'error' && <div className="mt-2 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700"><p>Не удалось загрузить модули Spotlight.</p><button type="button" onClick={retrySpotlightLoad} className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-black">Повторить</button></div>}
    {(spotlightSections.length > 0 || spotlightLoadState === 'ready') && <div className={`mt-2 grid gap-2 ${mobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`} role="group" aria-label="Модули Spotlight">
      <button type="button" aria-pressed={allSpotlightSectionsSelected} onClick={() => selectSpotlightSection(SPOTLIGHT_ALL_SECTIONS_ID)} className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${allSpotlightSectionsSelected ? 'border-amber-400 bg-amber-100' : 'border-indigo-50 bg-white hover:border-indigo-200'}`}><span className="min-w-0 text-sm font-black leading-tight text-indigo-950">Весь класс</span><span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-slate-500">все модули</span></button>
      {spotlightSections.map(section => {
        const selected = selectedSpotlightSectionIdSet.has(section.id);
        return <button type="button" key={section.id} aria-label={`${section.title}, ${formatWordCount(section.wordCount)}`} aria-pressed={selected} onClick={() => selectSpotlightSection(section.id)} className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${selected ? 'border-amber-400 bg-amber-100' : 'border-indigo-50 bg-white hover:border-indigo-200'}`}><span className="min-w-0 text-sm font-black leading-tight text-indigo-950">{selected ? '✓ ' : ''}{section.title}</span><span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-slate-500">{formatWordCount(section.wordCount)}</span></button>;
      })}
    </div>}
  </>;

  return <ScreenContainer className="max-w-4xl pb-20 pt-3 sm:pt-4">
    <header className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <button type="button" onClick={leaveDictionarySettings} aria-label="Назад без сохранения" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="min-w-0 text-center"><div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 sm:text-xs">Слова для игр</div><h1 className="truncate text-2xl font-black text-indigo-950 sm:text-3xl">Выбор словаря</h1></div>
      <div className="h-11 w-11" />
    </header>

    <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
      <div className="rounded-2xl bg-indigo-50 px-4 py-3"><div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{dirty ? 'Будет выбрано после сохранения' : 'Выбрано сейчас'}</div><div className="mt-1 break-words text-lg font-black text-indigo-950">{currentLabel}</div>{dirty && <div className="mt-1 text-xs font-bold text-amber-700">Сохраните выбор, чтобы применить его к играм.</div>}</div>
      {saveError && <div role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{saveError}</div>}

      <div className="mt-4 md:hidden">
        <p className="text-sm font-bold leading-6 text-slate-500">Сначала выберите словарь, затем уровень, тему или свой список.</p>
        <button type="button" onClick={() => { setMobileStep('source'); setMobileWizardOpen(true); }} className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-black text-white">Выбрать другой словарь</button>
      </div>

      <div className="hidden md:block">
        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Источник слов">
          {SOURCE_OPTIONS.map(option => {
            const active = source === option.source;
            const locked = option.source !== 'builtin' && !hasPremium;
            return <button key={option.source} type="button" aria-pressed={active} onClick={() => chooseSource(option.source)} className={`relative min-w-0 rounded-2xl border-2 p-3 text-left transition ${active ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-50 bg-white hover:border-indigo-200'}`}>
              {locked && <span className="absolute right-2 top-2 text-xs" aria-label="Доступно в Premium">🔒</span>}
              <div className="text-2xl" aria-hidden="true">{option.icon}</div><div className="mt-1 truncate text-sm font-black text-indigo-950">{option.title}</div><div className="truncate text-[11px] font-bold text-slate-400">{locked ? 'Premium' : option.note}</div>
            </button>;
          })}
        </div>

        {source === 'builtin' && <section className="mt-4 rounded-3xl border-2 border-indigo-100 bg-indigo-50/45 p-4">
          <h2 className="text-lg font-black text-indigo-950">{kidsMode ? 'Все уровни' : 'General English'}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{kidsMode ? 'Выберите уровень сложности: доступны все уровни от A1 до C2.' : 'Выберите сложность только для общего словаря. На тематические наборы этот уровень не влияет.'}</p>
          <DifficultyPicker value={draftSettings.difficulty} kidsMode={kidsMode} onChange={difficulty => setDraftSettings({ ...draftSettings, dictionarySource: 'builtin', useCustomDictionary: false, difficulty })} />
        </section>}

        {source === 'premium' && hasPremium && <section className="mt-4 rounded-3xl border-2 border-amber-100 bg-amber-50/55 p-4">
          <h2 className="text-lg font-black text-indigo-950">Какую тему тренировать</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">Выберите набор. Для школьного словаря затем укажите класс и один или несколько модулей.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Тематический словарь">{premiumCatalog.map(item => {
            const active = draftSettings.activePremiumDictionaryId === item.id;
            return <button type="button" key={item.id} aria-pressed={active} aria-expanded={item.id === SPOTLIGHT_PREMIUM_DICTIONARY_ID ? spotlightActive : undefined} onClick={() => selectPremiumDictionary(item.id)} className={`rounded-2xl border-2 bg-white p-3 text-left transition ${active ? 'border-amber-400 shadow-sm' : 'border-transparent hover:border-amber-200'}`}><div className="text-2xl" aria-hidden="true">{item.icon}</div><div className="mt-2 text-sm font-black leading-tight text-indigo-950">{item.shortTitle}</div>{item.id === SPOTLIGHT_PREMIUM_DICTIONARY_ID && <div className="mt-1 text-[11px] font-bold text-amber-700">класс и модули</div>}</button>;
          })}</div>

          {spotlightActive && <div className="mt-4 rounded-3xl border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-base font-black text-indigo-950">Школьные (Spotlight)</h3><p className="mt-1 text-xs font-bold text-slate-500">Выберите класс, затем отметьте несколько нужных модулей. «Весь класс» выбирается отдельно.</p></div><span className="max-w-full break-words rounded-2xl bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{getSpotlightSelectionLabel(spotlightGrade, selectedSpotlightSectionIds)}</span></div>
            <h4 className="mt-4 text-xs font-black uppercase tracking-wider text-amber-700">Класс</h4>
            <div className="mt-2 grid grid-cols-5 gap-2" role="group" aria-label="Класс Spotlight">{getSpotlightGrades().map(grade => <button type="button" key={grade} aria-pressed={spotlightGrade === grade} onClick={() => selectSpotlightGrade(grade)} className={`rounded-xl px-2 py-2.5 text-sm font-black transition ${spotlightGrade === grade ? 'bg-amber-200 text-amber-950 ring-2 ring-amber-400' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>{grade}</button>)}</div>
            <h4 className="mt-4 text-xs font-black uppercase tracking-wider text-amber-700">Модули</h4>
            {spotlightModuleChooser(false)}
          </div>}
        </section>}

        {source === 'custom' && hasPremium && <section className="mt-4 rounded-3xl border-2 border-purple-100 bg-purple-50/60 p-4">
          <h2 className="text-lg font-black text-indigo-950">Ваш список</h2><p className="mt-1 text-sm font-bold text-slate-500">{customDictionaryWords.length ? `Сейчас выбрано ${formatWordCount(customDictionaryWords.length)}.` : 'Список пока пуст.'}</p>
          <button type="button" onClick={onOpenDictionaryStudio} className="mt-4 w-full rounded-2xl bg-purple-600 px-5 py-3.5 font-black text-white">{customDictionaryWords.length ? 'Редактировать список' : 'Добавить слова'}</button>
        </section>}
      </div>

      <button type="button" disabled={saving || !dirty} onClick={() => void commit()} className="mt-5 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Сохраняю…' : dirty ? 'Готово' : 'Уже сохранено'}</button>
    </section>

    <AccessibleDialog open={mobileWizardOpen} titleId="mobile-dictionary-title" descriptionId="mobile-dictionary-description" onEscape={closeMobileWizard} overlayClassName="md:hidden" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Выбор словаря</div><h2 id="mobile-dictionary-title" className="mt-1 text-2xl font-black text-indigo-950">{mobileStep === 'source' ? 'Откуда брать слова?' : mobileStep === 'difficulty' ? 'Какой уровень?' : mobileStep === 'premium' ? 'Какую тему?' : mobileStep === 'spotlight_grade' ? 'Какой класс?' : mobileStep === 'spotlight_section' ? 'Какие модули?' : 'Ваш список слов'}</h2></div><button type="button" onClick={closeMobileWizard} aria-label="Закрыть" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl font-black text-indigo-700">×</button></div>
      <p id="mobile-dictionary-description" className="mt-2 text-sm font-bold leading-6 text-slate-500">{mobileStep === 'source' ? 'Выберите один источник. На следующем шаге можно уточнить уровень, тему или свой список.' : mobileStep === 'difficulty' ? 'Уровень влияет только на общий словарь.' : mobileStep === 'premium' ? 'Выберите школьный или тематический набор.' : mobileStep === 'spotlight_grade' ? 'Выберите класс учебника Spotlight.' : mobileStep === 'spotlight_section' ? 'Отметьте один или несколько модулей. «Весь класс» отменяет выбор отдельных модулей.' : 'Используются слова из вашего собственного списка.'}</p>

      {mobileStep === 'source' && <div className="mt-5 grid gap-3">{SOURCE_OPTIONS.map(option => { const locked = option.source !== 'builtin' && !hasPremium; return <button key={option.source} type="button" onClick={() => chooseMobileSource(option.source)} className="rounded-2xl border-2 border-indigo-100 bg-white p-4 text-left"><div className="flex items-start gap-3"><span className="text-3xl" aria-hidden="true">{option.icon}</span><div className="min-w-0"><div className="text-lg font-black text-indigo-950">{option.title}{locked ? ' · Premium' : ''}</div><div className="mt-1 text-sm font-bold leading-5 text-slate-500">{option.source === 'builtin' ? (kidsMode ? 'Бесплатный детский словарь для ежедневных игр.' : 'Общий английский словарь с выбором уровня A1–C2.') : option.source === 'premium' ? 'Школьные и тематические подборки.' : 'Слова из школы, курса или собственного списка.'}</div></div></div></button>; })}</div>}
      {mobileStep === 'difficulty' && <div className="mt-5"><DifficultyPicker value={draftSettings.difficulty} kidsMode={kidsMode} layout="mobile" onChange={chooseMobileDifficulty} /></div>}
      {mobileStep === 'premium' && <div className="mt-5 grid gap-3">{premiumCatalog.map(item => <button type="button" key={item.id} onClick={() => chooseMobilePremium(item.id)} className="rounded-2xl border-2 border-amber-100 bg-amber-50/60 p-4 text-left"><div className="flex gap-3"><span className="text-3xl" aria-hidden="true">{item.icon}</span><div><div className="text-lg font-black text-indigo-950">{item.title}</div><div className="mt-1 text-sm font-bold leading-5 text-slate-500">{item.id === SPOTLIGHT_PREMIUM_DICTIONARY_ID ? 'Школьные слова для 2–11 классов с выбором нескольких модулей.' : 'Тематическая подборка слов для тренировок.'}</div></div></div></button>)}</div>}
      {mobileStep === 'spotlight_grade' && <div className="mt-5 grid grid-cols-3 gap-3">{getSpotlightGrades().map(grade => <button type="button" key={grade} onClick={() => chooseMobileSpotlightGrade(grade)} className={`rounded-2xl border-2 p-4 text-center text-xl font-black ${spotlightGrade === grade ? 'border-amber-400 bg-amber-100 text-amber-950' : 'border-indigo-100 bg-white text-indigo-800'}`}>{grade} класс</button>)}</div>}
      {mobileStep === 'spotlight_section' && <div className="mt-5"><div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">{getSpotlightSelectionLabel(spotlightGrade, selectedSpotlightSectionIds)}</div>{spotlightModuleChooser(true)}<button type="button" onClick={closeMobileWizard} className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-3.5 font-black text-white">Готово с модулями</button></div>}
      {mobileStep === 'custom' && <div className="mt-5 rounded-2xl bg-purple-50 p-4"><div className="text-lg font-black text-indigo-950">{customDictionaryWords.length ? `${formatWordCount(customDictionaryWords.length)} в списке` : 'Список пока пуст'}</div><p className="mt-2 text-sm font-bold leading-6 text-slate-500">Добавляйте слова из школы или собственного курса.</p><button type="button" onClick={() => { closeMobileWizard(); onOpenDictionaryStudio(); }} className="mt-4 w-full rounded-2xl bg-purple-600 px-5 py-3.5 font-black text-white">{customDictionaryWords.length ? 'Редактировать список' : 'Добавить слова'}</button><button type="button" onClick={closeMobileWizard} className="mt-2 w-full rounded-2xl bg-white px-5 py-3.5 font-black text-purple-700">Использовать этот список</button></div>}
      {mobileStep !== 'source' && <button type="button" onClick={() => setMobileStep(mobileStep === 'spotlight_section' ? 'spotlight_grade' : mobileStep === 'spotlight_grade' ? 'premium' : 'source')} className="mt-5 w-full rounded-2xl border-2 border-indigo-100 px-5 py-3 font-black text-indigo-700">← Назад</button>}
    </AccessibleDialog>
  </ScreenContainer>;
};
