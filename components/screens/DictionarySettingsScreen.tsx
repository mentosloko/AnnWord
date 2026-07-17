import React from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, UserProfile } from '../../types';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { isKidsMode } from '../../services/modeFlags';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { ScreenContainer } from '../layout/ScreenContainer';

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

const DIFFICULTIES: Array<{ value: DifficultyLevel; short: string }> = [{ value: 'ALL', short: 'Все' }, { value: 'A1', short: 'A1' }, { value: 'A2', short: 'A2' }, { value: 'B1', short: 'B1' }, { value: 'B2', short: 'B2' }, { value: 'C1', short: 'C1' }, { value: 'C2', short: 'C2' }];
const PREMIUM_VALUE: Record<string, string> = {
  premium_business_english: 'Переговоры и рабочая переписка',
  premium_travel_english: 'Увереннее говорить в поездках',
  premium_medical_english: 'Профессиональная медицинская лексика',
  premium_ielts_academic: 'Подготовка к экзамену и academic English',
  premium_it_digital: 'Работа в IT и digital-командах',
  premium_finance_banking: 'Финансы, банки и инвестиции',
  premium_legal_compliance: 'Договоры, право и compliance',
  premium_science_research: 'Статьи, исследования и конференции',
  premium_everyday_advanced: 'Более естественная повседневная речь',
  premium_food_hospitality: 'Еда, рестораны и гостеприимство',
};
const KIDS_VALUE: Record<string, string> = {
  kids_grade_1: 'Первые школьные слова',
  kids_grade_2: 'Лексика второго класса',
  kids_grade_3: 'Чтение и истории',
  kids_animals: 'Любимые животные',
  kids_food_home: 'Еда, семья и дом',
  kids_school_daily: 'Школа и обычный день',
};

export const DictionarySettingsScreen: React.FC<DictionarySettingsScreenProps> = ({ settings, userProfile, customDictionaryWords, isAuthenticated, onSettingsChange, onOpenDictionaryStudio, onOpenPremium, onBack }) => {
  const parentMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = settings.dictionarySource;
  const isBuiltin = source === 'builtin' && !settings.useCustomDictionary;
  const isCustom = source === 'custom' || settings.useCustomDictionary;
  const isPremium = source === 'premium';
  const premiumCatalog = parentMode ? getKidsDictionaryCatalog() : getPremiumDictionaryCatalog();
  const selectedTopic = premiumCatalog.find(item => item.id === settings.activePremiumDictionaryId) || premiumCatalog[0];
  const currentLabel = isCustom ? 'Ваш список' : isPremium ? selectedTopic.title : parentMode ? 'Детский словарь' : 'General English';

  const chooseSource = (nextSource: DictionarySource) => {
    if ((nextSource === 'custom' || nextSource === 'premium') && (!isAuthenticated || !hasPremium)) { onOpenPremium(); return; }
    onSettingsChange({ ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom' });
  };
  const chooseTopic = (id: string) => {
    if (!hasPremium) { onOpenPremium(); return; }
    onSettingsChange({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: id });
  };

  return <ScreenContainer className="max-w-5xl pb-20 pt-3 sm:pt-4">
    <header className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:mb-5"><button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><div className="min-w-0 text-center"><div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 sm:text-xs">Слова для игр</div><h1 className="truncate text-2xl font-black text-indigo-950 sm:text-3xl">Выбор словаря</h1></div><div className="h-11 w-11" /></header>

    <section className="rounded-[1.75rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-50 px-4 py-3 sm:rounded-3xl sm:px-5 sm:py-4"><div><div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Выбрано сейчас</div><div className="mt-1 text-lg font-black text-indigo-950 sm:text-xl">{currentLabel}</div></div><span className="text-2xl" aria-hidden="true">{isCustom ? '🧩' : isPremium ? selectedTopic.icon : parentMode ? '🌈' : '📚'}</span></div>

      <section className="mt-4 rounded-3xl border-2 border-indigo-100 bg-white p-4 sm:p-5" aria-labelledby="builtin-dictionary-title">
        <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="text-3xl" aria-hidden="true">{parentMode ? '🌈' : '📚'}</span><div><h2 id="builtin-dictionary-title" className="text-xl font-black text-indigo-950">{parentMode ? 'Детский словарь' : 'General English'}</h2><p className="mt-1 text-sm font-bold text-gray-500">{parentMode ? 'Базовые слова для первых тренировок.' : 'Встроенный словарь с разными уровнями сложности.'}</p></div></div><button type="button" onClick={() => chooseSource('builtin')} aria-pressed={isBuiltin} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${isBuiltin ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{isBuiltin ? 'Выбран' : 'Выбрать'}</button></div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Уровень сложности">{DIFFICULTIES.map(level => <button type="button" key={level.value} aria-pressed={settings.difficulty === level.value} onClick={() => onSettingsChange({ ...settings, difficulty: level.value })} className={`rounded-xl py-2.5 text-sm font-black ${settings.difficulty === level.value ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-100 text-indigo-700'}`}>{level.short}</button>)}</div>
      </section>

      <section className="mt-5" aria-labelledby="premium-topics-title">
        <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-widest text-amber-500">Premium</div><h2 id="premium-topics-title" className="mt-1 text-xl font-black text-indigo-950 sm:text-2xl">{parentMode ? 'Слова, которые интересны ребёнку' : 'Словарь под вашу цель'}</h2></div>{hasPremium && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Доступ открыт</span>}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">{premiumCatalog.map(item => {
          const active = isPremium && settings.activePremiumDictionaryId === item.id;
          const value = parentMode ? KIDS_VALUE[item.id] : PREMIUM_VALUE[item.id];
          return <button type="button" key={item.id} onClick={() => chooseTopic(item.id)} aria-pressed={active} className={`relative rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-amber-300 bg-amber-50' : 'border-indigo-50 bg-slate-50 hover:border-amber-200 hover:bg-white'}`}><div className="flex items-start justify-between gap-2"><span className="text-2xl" aria-hidden="true">{item.icon}</span>{!hasPremium && <span aria-label="Доступно в Premium" className="text-xs">🔒</span>}</div><div className="mt-2 text-sm font-black leading-tight text-indigo-950">{item.shortTitle}</div><div className="mt-1 hidden text-[11px] font-bold leading-snug text-gray-500 sm:block">{value || item.title}</div></button>;
        })}</div>
        {!hasPremium && <button type="button" onClick={onOpenPremium} className="mt-3 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 text-left text-white shadow-lg shadow-indigo-600/15"><span className="block text-base font-black">Открыть слова под свою цель</span><span className="mt-1 block text-xs font-bold text-indigo-100">Тематические наборы и тренировка по собственному списку.</span></button>}
      </section>

      <section className="mt-5 rounded-3xl border-2 border-purple-100 bg-purple-50/60 p-4 sm:p-5" aria-labelledby="own-words-title"><div className="flex items-start gap-3"><span className="text-3xl" aria-hidden="true">🧩</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 id="own-words-title" className="text-xl font-black text-indigo-950">Ваши слова</h2><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-purple-700">{hasPremium ? 'доступно' : 'Premium'}</span></div><p className="mt-1 text-sm font-bold text-gray-600">{customDictionaryWords.length ? 'Тренируйте лексику из курса, работы, школы или учебника.' : parentMode ? 'Добавьте слова из школы или учебника.' : 'Добавьте слова из работы, курса, экзамена или своей темы.'}</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => chooseSource('custom')} className="rounded-xl border-2 border-purple-100 bg-white px-3 py-2.5 text-sm font-black text-purple-700">Выбрать</button><button type="button" onClick={hasPremium ? onOpenDictionaryStudio : onOpenPremium} className="rounded-xl bg-purple-600 px-3 py-2.5 text-sm font-black text-white">Добавить слова</button></div></div></div></section>

      <button type="button" onClick={onBack} className="mt-5 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700">Готово</button>
    </section>
  </ScreenContainer>;
};