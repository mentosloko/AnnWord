import React from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, UserProfile } from '../../types';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { isKidsMode } from '../../services/modeFlags';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import {
  getSpotlightDictionaryMeta,
  getSpotlightSelectionLabel,
  isSpotlightDictionaryId,
  SPOTLIGHT_ALL_SECTION_ID,
} from '../../services/spotlightDictionaryCatalog';
import { ScreenContainer } from '../layout/ScreenContainer';
import { SpotlightSelectionPanel } from './SpotlightSelectionPanel';

interface DictionarySettingsScreenProps {
  settings: GameSettings;
  userProfile: UserProfile;
  customDictionaryWords: string[];
  isAuthenticated: boolean;
  onSettingsChange: (settings: GameSettings) => void;
  onOpenDictionaryStudio: () => void;
  onOpenPremium: () => void;
  onBack: () => void;
}

const DIFFICULTIES: Array<{ value: DifficultyLevel; short: string }> = [
  { value: 'ALL', short: 'Все' },
  { value: 'A1', short: 'A1' },
  { value: 'A2', short: 'A2' },
  { value: 'B1', short: 'B1' },
  { value: 'B2', short: 'B2' },
  { value: 'C1', short: 'C1' },
  { value: 'C2', short: 'C2' },
];

const SOURCE_OPTIONS: Array<{ source: DictionarySource; icon: string; title: string; note: string }> = [
  { source: 'builtin', icon: '📚', title: 'Общий', note: 'General English' },
  { source: 'premium', icon: '✨', title: 'Тематический', note: 'слова под цель' },
  { source: 'custom', icon: '🧩', title: 'Свой', note: 'ваш список' },
];

export const DictionarySettingsScreen: React.FC<DictionarySettingsScreenProps> = ({
  settings,
  userProfile,
  customDictionaryWords,
  isAuthenticated,
  onSettingsChange,
  onOpenDictionaryStudio,
  onOpenPremium,
  onBack,
}) => {
  const kidsMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = settings.dictionarySource;
  const premiumCatalog = kidsMode
    ? [...getKidsDictionaryCatalog(), getSpotlightDictionaryMeta()]
    : getPremiumDictionaryCatalog();
  const selectedTopic = premiumCatalog.find(item => item.id === settings.activePremiumDictionaryId) || premiumCatalog[0];
  const spotlightSelected = isSpotlightDictionaryId(settings.activePremiumDictionaryId);

  const chooseSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && (!isAuthenticated || !hasPremium)) {
      onOpenPremium();
      return;
    }
    onSettingsChange({
      ...settings,
      dictionarySource: nextSource,
      useCustomDictionary: nextSource === 'custom',
      activePremiumDictionaryId: nextSource === 'premium'
        ? settings.activePremiumDictionaryId || premiumCatalog[0]?.id
        : settings.activePremiumDictionaryId,
    });
  };

  const choosePremiumDictionary = (id: string) => onSettingsChange({
    ...settings,
    dictionarySource: 'premium',
    useCustomDictionary: false,
    activePremiumDictionaryId: id,
    activeSpotlightGrade: isSpotlightDictionaryId(id) ? settings.activeSpotlightGrade || 2 : settings.activeSpotlightGrade,
    activeSpotlightSectionId: isSpotlightDictionaryId(id) ? settings.activeSpotlightSectionId || SPOTLIGHT_ALL_SECTION_ID : settings.activeSpotlightSectionId,
  });

  const currentLabel = source === 'custom'
    ? 'Ваш список'
    : source === 'premium'
      ? spotlightSelected ? getSpotlightSelectionLabel(settings) : selectedTopic?.title || 'Тематический словарь'
      : kidsMode
        ? 'Детский словарь'
        : `General English · ${settings.difficulty === 'ALL' ? 'все уровни' : settings.difficulty}`;

  return <ScreenContainer className="max-w-4xl pb-20 pt-3 sm:pt-4">
    <header className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="min-w-0 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 sm:text-xs">Слова для игр</div>
        <h1 className="truncate text-2xl font-black text-indigo-950 sm:text-3xl">Выбор словаря</h1>
      </div>
      <div className="h-11 w-11" />
    </header>

    <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
      <div className="rounded-2xl bg-indigo-50 px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Выбрано сейчас</div>
        <div className="mt-1 text-lg font-black text-indigo-950">{currentLabel}</div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Источник слов">
        {SOURCE_OPTIONS.map(option => {
          const active = source === option.source;
          const locked = option.source !== 'builtin' && !hasPremium;
          return <button
            key={option.source}
            type="button"
            aria-pressed={active}
            onClick={() => chooseSource(option.source)}
            className={`relative min-w-0 rounded-2xl border-2 p-3 text-left transition ${active ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-50 bg-white hover:border-indigo-200'}`}
          >
            {locked && <span className="absolute right-2 top-2 text-xs" aria-label="Доступно в Premium">🔒</span>}
            <div className="text-2xl" aria-hidden="true">{option.icon}</div>
            <div className="mt-1 truncate text-sm font-black text-indigo-950">{option.title}</div>
            <div className="truncate text-[11px] font-bold text-slate-400">{locked ? 'Premium' : option.note}</div>
          </button>;
        })}
      </div>

      {source === 'builtin' && <section className="mt-4 rounded-3xl border-2 border-indigo-100 bg-indigo-50/45 p-4">
        <h2 className="text-lg font-black text-indigo-950">{kidsMode ? 'Детский словарь' : 'General English'}</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">Выберите сложность только для общего словаря. На тематические наборы этот уровень не влияет.</p>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Уровень сложности">
          {DIFFICULTIES.map(level => <button
            type="button"
            key={level.value}
            aria-pressed={settings.difficulty === level.value}
            onClick={() => onSettingsChange({ ...settings, dictionarySource: 'builtin', useCustomDictionary: false, difficulty: level.value })}
            className={`rounded-xl py-2.5 text-sm font-black ${settings.difficulty === level.value ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-100 bg-white text-indigo-700'}`}
          >{level.short}</button>)}
        </div>
      </section>}

      {source === 'premium' && hasPremium && <section className="mt-4 rounded-3xl border-2 border-amber-100 bg-amber-50/55 p-4">
        <h2 className="text-lg font-black text-indigo-950">Какую тему тренировать</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">Для Spotlight можно дополнительно выбрать класс и модуль.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Тематический словарь">
          {premiumCatalog.map(item => {
            const active = settings.activePremiumDictionaryId === item.id;
            return <button
              type="button"
              key={item.id}
              aria-pressed={active}
              onClick={() => choosePremiumDictionary(item.id)}
              className={`rounded-2xl border-2 bg-white p-3 text-left transition ${active ? 'border-amber-400 shadow-sm' : 'border-transparent hover:border-amber-200'}`}
            >
              <div className="text-2xl" aria-hidden="true">{item.icon}</div>
              <div className="mt-2 text-sm font-black leading-tight text-indigo-950">{item.shortTitle}</div>
              {isSpotlightDictionaryId(item.id) && <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-blue-600">2–11 классы</div>}
            </button>;
          })}
        </div>
        {spotlightSelected && <SpotlightSelectionPanel settings={settings} onSettingsChange={onSettingsChange} />}
      </section>}

      {source === 'custom' && hasPremium && <section className="mt-4 rounded-3xl border-2 border-purple-100 bg-purple-50/60 p-4">
        <h2 className="text-lg font-black text-indigo-950">Ваш список</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">{customDictionaryWords.length ? `Сейчас выбрано ${customDictionaryWords.length} слов.` : 'Список пока пуст.'}</p>
        <button type="button" onClick={onOpenDictionaryStudio} className="mt-4 w-full rounded-2xl bg-purple-600 px-5 py-3.5 font-black text-white">
          {customDictionaryWords.length ? 'Редактировать список' : 'Добавить слова'}
        </button>
      </section>}

      <button type="button" onClick={onBack} className="mt-5 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700">Готово</button>
    </section>
  </ScreenContainer>;
};
