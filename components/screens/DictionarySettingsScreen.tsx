import React from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, UserProfile } from '../../types';
import { getPremiumDictionaryCatalog, getPremiumDictionaryMeta, getPremiumDictionaryWords, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
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

const DIFFICULTIES: Array<{ value: DifficultyLevel; short: string }> = [
  { value: 'ALL', short: 'Все' },
  { value: 'A1', short: 'A1' },
  { value: 'A2', short: 'A2' },
  { value: 'B1', short: 'B1' },
  { value: 'B2', short: 'B2' },
  { value: 'C1', short: 'C1' },
  { value: 'C2', short: 'C2' },
];

export const DictionarySettingsScreen: React.FC<DictionarySettingsScreenProps> = ({ settings, userProfile, customDictionaryWords, isAuthenticated, onSettingsChange, onOpenDictionaryStudio, onOpenPremium, onBack }) => {
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const premiumCatalog = getPremiumDictionaryCatalog();
  const activePremium = getPremiumDictionaryMeta(settings.activePremiumDictionaryId);
  const isBuiltin = settings.dictionarySource === 'builtin' && !settings.useCustomDictionary;
  const isCustom = settings.dictionarySource === 'custom' || settings.useCustomDictionary;
  const isPremium = settings.dictionarySource === 'premium';

  const selectDictionarySource = (source: DictionarySource) => {
    if ((source === 'custom' || source === 'premium') && (!isAuthenticated || !hasPremium)) {
      onOpenPremium();
      return;
    }
    onSettingsChange({ ...settings, dictionarySource: source, useCustomDictionary: source === 'custom' });
  };
  const selectPremiumDictionary = (id: string) => {
    if (!hasPremium) {
      onOpenPremium();
      return;
    }
    onSettingsChange({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: id });
  };
  const updateDifficulty = (difficulty: DifficultyLevel) => onSettingsChange({ ...settings, difficulty });
  const cardClass = (active: boolean, tone: 'indigo' | 'purple' | 'amber') => {
    const activeTone = tone === 'purple' ? 'border-purple-300 bg-purple-50' : tone === 'amber' ? 'border-amber-300 bg-amber-50' : 'border-indigo-300 bg-indigo-50';
    return `rounded-[1.75rem] border-2 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? activeTone : 'border-indigo-50 bg-white hover:border-indigo-100'}`;
  };
  const premiumWordCount = getPremiumDictionaryWords(settings.activePremiumDictionaryId, settings.difficulty).length;

  return <ScreenContainer className="max-w-5xl pb-20 pt-4">
    <header className="mb-5 flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Слова для игр</div>
        <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Выбор словаря</h1>
      </div>
      <div className="h-11 w-11" />
    </header>

    <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 rounded-3xl bg-indigo-50 p-4">
        <h2 className="text-xl font-black text-indigo-950">Здесь меняется активный словарь</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-indigo-700">Выберите, какие слова будут использоваться в играх. Это отдельный экран без запуска тренировки.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => selectDictionarySource('builtin')} aria-pressed={isBuiltin} className={cardClass(isBuiltin, 'indigo')}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-3xl" aria-hidden="true">📚</span>
            {isBuiltin && <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 shadow-sm">Активен</span>}
          </div>
          <h3 className="mt-4 text-2xl font-black text-indigo-950">General English</h3>
          <p className="mt-2 text-sm font-bold text-gray-500">Встроенный словарь по уровням сложности.</p>
        </button>

        <button type="button" onClick={() => selectDictionarySource('custom')} aria-pressed={isCustom && hasPremium} className={cardClass(isCustom && hasPremium, 'purple')}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-3xl" aria-hidden="true">🧩</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-700 shadow-sm">{hasPremium ? isCustom ? 'Активен' : 'Premium' : '🔒 Premium'}</span>
          </div>
          <h3 className="mt-4 text-2xl font-black text-indigo-950">Мой словарь</h3>
          <p className="mt-2 text-sm font-bold text-gray-500">{customDictionaryWords.length ? `${customDictionaryWords.length} слов в личном списке.` : 'Личный список пока пуст.'}</p>
          <span onClick={event => { event.stopPropagation(); onOpenDictionaryStudio(); }} className="mt-4 inline-flex rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white" role="button" tabIndex={0}>Редактировать</span>
        </button>

        <button type="button" onClick={() => selectDictionarySource('premium')} aria-pressed={isPremium && hasPremium} className={cardClass(isPremium && hasPremium, 'amber')}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-3xl" aria-hidden="true">{activePremium.icon}</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 shadow-sm">{hasPremium ? isPremium ? 'Активен' : 'Premium' : '🔒 Premium'}</span>
          </div>
          <h3 className="mt-4 text-2xl font-black text-indigo-950">Premium-словари</h3>
          <p className="mt-2 text-sm font-bold text-gray-500">Тематические наборы: сейчас {activePremium.shortTitle}, {premiumWordCount} слов.</p>
        </button>
      </div>

      {(isBuiltin || (isPremium && hasPremium)) && <section className="mt-6" aria-labelledby="dictionary-difficulty-title">
        <h2 id="dictionary-difficulty-title" className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">{isPremium ? 'Уровень Premium-словаря' : 'Сложность General English'}</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Сложность словаря">
          {DIFFICULTIES.map(level => {
            const count = isPremium ? getPremiumDictionaryWords(settings.activePremiumDictionaryId, level.value).length : null;
            const disabled = isPremium && count === 0;
            return <button type="button" key={level.value} aria-pressed={settings.difficulty === level.value} disabled={disabled} onClick={() => updateDifficulty(level.value)} className={`rounded-2xl py-2.5 text-sm font-black disabled:opacity-35 ${settings.difficulty === level.value ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-100 text-indigo-700'}`}><span>{level.short}</span>{isPremium && <span className="mt-0.5 block text-[10px] font-bold opacity-75">{count}</span>}</button>;
          })}
        </div>
      </section>}

      {isPremium && hasPremium && <section className="mt-6 rounded-2xl border-2 border-dashed border-amber-100 bg-amber-50/60 p-4">
        <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-amber-500">Выберите Premium-словарь</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Выбор Premium-словаря">
          {premiumCatalog.map(item => <button type="button" key={item.id} aria-pressed={settings.activePremiumDictionaryId === item.id} onClick={() => selectPremiumDictionary(item.id)} className={`rounded-2xl border-2 p-3 text-left transition ${settings.activePremiumDictionaryId === item.id ? 'border-amber-400 bg-white shadow-sm' : 'border-white bg-white/70 hover:bg-white'}`}>
            <div className="text-xl" aria-hidden="true">{item.icon}</div>
            <div className="truncate text-xs font-black text-indigo-950">{item.shortTitle}</div>
            <div className="text-[10px] font-black text-amber-700">{item.wordCount} слов</div>
          </button>)}
        </div>
      </section>}

      {isCustom && hasPremium && !customDictionaryWords.length && <div className="mt-5 rounded-2xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-700">Чтобы играть по “Моему словарю”, сначала добавьте слова в редакторе.</div>}

      <button type="button" onClick={onBack} className="mt-6 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700">Готово</button>
    </section>
  </ScreenContainer>;
};
