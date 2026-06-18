import React from 'react';
import { DictionarySource, DifficultyLevel, GameSettings, UserProfile, WordLength } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { getPremiumDictionaryCatalog, getPremiumDictionaryWords, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { ScreenContainer } from '../layout/ScreenContainer';
import { PlayableModeRoute } from '../AppScreens';

interface SetupScreenProps { selectedPlayMode: PlayableModeRoute; settings: GameSettings; customDictionaryWords: string[]; setupError: string | null; isUploadingDictionary: boolean; isAuthenticated: boolean; userProfile: UserProfile; onSettingsChange: (settings: GameSettings) => void; onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; onOpenDictionaryStudio: () => void; onOpenPremium: () => void; onStartGame: () => void; onBack: () => void; onLogin: () => void; }
const WORD_LENGTHS: WordLength[] = [4, 5, 6];
const DIFFICULTIES: Array<{ value: DifficultyLevel; short: string }> = [{ value: 'ALL', short: 'Все' }, { value: 'A1', short: 'A1' }, { value: 'A2', short: 'A2' }, { value: 'B1', short: 'B1' }, { value: 'B2', short: 'B2' }, { value: 'C1', short: 'C1' }, { value: 'C2', short: 'C2' }];
const MODE_LABELS: Record<PlayableModeRoute, string> = { game: 'Классика', anagrams: 'Анаграммы', translation: '1 из 2', sprint: 'Спринт', memory: 'Память', hangman: 'Виселица', letter_square: 'Квадрат слов' };
const LENGTH_AGNOSTIC_MODES = new Set<PlayableModeRoute>(['translation', 'sprint', 'memory', 'letter_square']);

export const SetupScreen: React.FC<SetupScreenProps> = ({ selectedPlayMode, settings, customDictionaryWords, setupError, isUploadingDictionary, isAuthenticated, userProfile, onOpenDictionaryStudio, onOpenPremium, onSettingsChange, onStartGame, onBack, onLogin }) => {
  const parentMode = isKidsMode(userProfile, isAuthenticated);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const source = parentMode && settings.dictionarySource === 'premium' ? 'builtin' : settings.dictionarySource;
  const ignoresWordLength = LENGTH_AGNOSTIC_MODES.has(selectedPlayMode);
  const matchesModeLength = (word: string) => ignoresWordLength || word.trim().length === settings.wordLength;
  const customWordsCount = customDictionaryWords.filter(matchesModeLength).length;
  const premiumWordsCount = !parentMode && source === 'premium' ? getPremiumDictionaryWords(settings.activePremiumDictionaryId, settings.difficulty).filter(matchesModeLength).length : 0;
  const canStart = source === 'custom' ? hasPremium && customWordsCount > 0 : source === 'premium' ? hasPremium && premiumWordsCount > 0 : true;
  const setSource = (nextSource: DictionarySource) => {
    if (nextSource === 'premium' && parentMode) return onSettingsChange({ ...settings, dictionarySource: 'builtin', useCustomDictionary: false });
    if ((nextSource === 'custom' || nextSource === 'premium') && !isAuthenticated) return onLogin();
    if ((nextSource === 'custom' || nextSource === 'premium') && !hasPremium) return onOpenPremium();
    onSettingsChange({ ...settings, dictionarySource: nextSource, useCustomDictionary: nextSource === 'custom' });
  };
  const sources: Array<{ value: DictionarySource; label: string; detail: string; icon: string }> = [
    { value: 'builtin', label: 'Встроенный', detail: 'по уровням', icon: '📚' },
    { value: 'custom', label: 'Мой словарь', detail: hasPremium ? `${customWordsCount} слов` : 'Premium', icon: '🧩' },
    ...parentMode ? [] : [{ value: 'premium' as DictionarySource, label: 'Premium', detail: hasPremium ? `${premiumWordsCount} слов` : '10 тем', icon: '✨' }],
  ];
  return <ScreenContainer className="max-w-3xl px-3 pb-20 pt-3 sm:px-4">
    <div className="mb-3 flex items-center justify-between gap-3"><button type="button" onClick={onBack} aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button><div className="text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{MODE_LABELS[selectedPlayMode]}</div><h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">Перед стартом</h1></div><div className="h-11 w-11" /></div>
    <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:p-6">
      {setupError && <div role="alert" aria-live="assertive" className="mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{setupError}</div>}
      <section><h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Длина слова</h2>{ignoresWordLength ? <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">В этом режиме используются слова любой длины.</div> : <div className="grid grid-cols-3 gap-2">{WORD_LENGTHS.map(length => <button type="button" key={length} aria-pressed={settings.wordLength === length} onClick={() => onSettingsChange({ ...settings, wordLength: length })} className={`rounded-2xl py-3 font-black ${settings.wordLength === length ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-100 text-indigo-700'}`}>{length}</button>)}</div>}</section>
      <section className="mt-4"><h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">Слова для игры</h2><div className={`grid gap-2 ${parentMode ? 'grid-cols-2' : 'grid-cols-3'}`}>{sources.map(item => <button type="button" key={item.value} aria-pressed={source === item.value} onClick={() => setSource(item.value)} className={`rounded-2xl border-2 p-3 text-left ${source === item.value ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-100'}`}><div className="text-xl" aria-hidden="true">{item.icon}</div><div className="text-sm font-black">{item.label}</div><div className="text-[11px] font-bold text-gray-400">{item.detail}</div></button>)}</div></section>
      {(source === 'builtin' || source === 'premium') && <section className="mt-4"><h2 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-400">{source === 'premium' ? 'Уровень Premium-словаря' : 'Сложность'}</h2><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{DIFFICULTIES.map(level => <button type="button" key={level.value} aria-pressed={settings.difficulty === level.value} onClick={() => onSettingsChange({ ...settings, difficulty: level.value })} className={`rounded-2xl py-2.5 text-sm font-black ${settings.difficulty === level.value ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-100 text-indigo-700'}`}>{level.short}</button>)}</div></section>}
      {source === 'premium' && hasPremium && <section className="mt-4 rounded-2xl border-2 border-dashed border-amber-100 bg-amber-50/50 p-4"><h2 className="mb-3 text-xs font-black uppercase tracking-widest text-amber-500">Premium-словарь</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{getPremiumDictionaryCatalog().map(item => <button type="button" key={item.id} onClick={() => onSettingsChange({ ...settings, dictionarySource: 'premium', useCustomDictionary: false, activePremiumDictionaryId: item.id })} className="rounded-2xl border-2 border-white bg-white/70 p-3 text-left"><div className="text-xl" aria-hidden="true">{item.icon}</div><div className="truncate text-xs font-black text-indigo-950">{item.shortTitle}</div></button>)}</div></section>}
      {source === 'custom' && hasPremium && <section className="mt-4 rounded-2xl border-2 border-dashed border-purple-100 bg-purple-50/50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><span className="block font-black text-indigo-950">{customDictionaryWords.length ? 'Словарь готов к игре' : 'Создайте словарь'}</span><span className="block text-xs font-bold text-gray-500">Загрузка и распознавание — в студии словарей</span></div><button type="button" onClick={onOpenDictionaryStudio} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white">Открыть студию</button></div>{isUploadingDictionary && <p className="mt-2 text-xs font-bold text-purple-700">Сохраняю словарь...</p>}</section>}
      <button type="button" onClick={onStartGame} disabled={!canStart} className={`mt-5 w-full rounded-2xl py-4 font-black ${canStart ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{canStart ? `Начать: ${MODE_LABELS[selectedPlayMode]}` : source === 'custom' && !hasPremium ? 'Нужен Premium' : source === 'premium' && !hasPremium ? 'Нужен Premium' : 'Нет слов для игры'}</button>
    </div>
  </ScreenContainer>;
};
