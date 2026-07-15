import React, { useEffect, useRef, useState } from 'react';
import { AccountMode } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface AccountModeSetupScreenProps {
  onSelectMode: (mode: AccountMode) => Promise<void>;
  suggestedMode?: AccountMode | null;
}
const PRACTICE_IMAGE = '/assets/branding/annword-logo-mark.svg';
const s = {
  welcome: 'Добро пожаловать в AnnWord',
  heading: 'Выберите формат',
  hint: 'Это определит интерфейс, домашний экран и следующий шаг настройки.',
  fail: 'Не удалось сохранить выбор.',
  saving: 'Сохраняю…',
  next: 'Что будет дальше',
};
const OPTIONS: Array<{ mode: AccountMode; imageSrc: string; title: string; tag: string; description: string; bullets: string[]; nextStep: string; cta: string; accent: string; button: string }> = [
  { mode: 'player', imageSrc: PRACTICE_IMAGE, title: 'Practice', tag: 'для себя', description: 'Взрослая ежедневная практика английских слов без детской экономики.', bullets: ['быстрый старт тренировки', 'уровни сложности и словари', 'статистика и слова к повторению'], nextStep: 'Вы сразу попадёте на домашний экран Practice и сможете начать тренировку.', cta: 'Учить слова самому', accent: 'border-indigo-100 bg-indigo-50/50 hover:border-indigo-300', button: 'bg-indigo-600 hover:bg-indigo-700' },
  { mode: 'parent', imageSrc: '/assets/onboarding/account-mode-parent.webp', title: 'Kids', tag: 'для ребёнка', description: 'Игровой режим: ребёнок учит слова, взрослый управляет профилем.', bullets: ['питомец, монеты и задания', 'PIN для кабинета родителя', 'код ребёнка для преподавателя'], nextStep: 'Дальше вы добавите имя ребёнка, PIN родителя и ребёнок назовёт питомца.', cta: 'Создать детский режим', accent: 'border-purple-100 bg-purple-50/50 hover:border-purple-300', button: 'bg-purple-600 hover:bg-purple-700' },
  { mode: 'teacher', imageSrc: '/assets/onboarding/account-mode-teacher.webp', title: 'Teacher', tag: 'для преподавателя', description: 'Рабочий кабинет без игр, питомцев и монет.', bullets: ['подключение ученика по коду', 'просмотр прогресса', 'создание и назначение словарей'], nextStep: 'Вы попадёте в кабинет, где можно сразу подключить первого ученика.', cta: 'Войти как преподаватель', accent: 'border-cyan-100 bg-cyan-50/50 hover:border-cyan-300', button: 'bg-cyan-700 hover:bg-cyan-800' },
];

const getModeFromCurrentPath = (): AccountMode | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/practice') return 'player';
  if (path === '/kids') return 'parent';
  if (path === '/teacher') return 'teacher';
  return null;
};

const getModeTitle = (mode: AccountMode): string => mode === 'player' ? 'AnnWord Practice' : mode === 'parent' ? 'AnnWord Kids' : 'AnnWord Teacher';

export const AccountModeSetupScreen: React.FC<AccountModeSetupScreenProps> = ({ onSelectMode, suggestedMode }) => {
  const autoModeRef = useRef<AccountMode | null>(suggestedMode || getModeFromCurrentPath());
  const autoSelectStartedRef = useRef(false);
  const [selected, setSelected] = useState<AccountMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (mode: AccountMode) => {
    setSelected(mode);
    setError(null);
    try { await onSelectMode(mode); }
    catch (problem: unknown) { setSelected(null); setError(problem instanceof Error ? problem.message : s.fail); }
  };

  useEffect(() => {
    const autoMode = autoModeRef.current;
    if (!autoMode || autoSelectStartedRef.current) return;
    autoSelectStartedRef.current = true;
    void choose(autoMode);
  }, []);

  if (autoModeRef.current && !error) {
    return <ScreenContainer className="max-w-2xl pb-20 pt-16"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-8 text-center shadow-sm"><div className="mx-auto h-16 w-16 animate-pulse rounded-3xl bg-indigo-100" /><h1 className="mt-5 text-2xl font-black text-indigo-950">Настраиваю {getModeTitle(autoModeRef.current)}</h1><p className="mt-3 text-sm font-bold leading-relaxed text-gray-500">Сохраняю выбранный формат и открываю нужный домашний экран.</p></section></ScreenContainer>;
  }

  return <ScreenContainer className="max-w-6xl pb-20 pt-6"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-8"><div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{s.welcome}</div><h1 className="mt-3 text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">{s.heading}</h1><p className="mt-3 text-sm font-bold leading-relaxed text-gray-500 sm:text-base">{s.hint}</p></div>{error && <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}<div className="mt-7 grid gap-4 lg:grid-cols-3">{OPTIONS.map(option => <button key={option.mode} type="button" disabled={selected !== null} onClick={() => void choose(option.mode)} className={`flex h-full flex-col rounded-[2rem] border-2 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg disabled:opacity-60 sm:p-5 ${option.accent}`}><div className="flex items-start justify-between gap-3"><img src={option.imageSrc} alt="" aria-hidden="true" className="h-20 w-20 rounded-3xl bg-white object-contain p-2 shadow-sm" draggable={false} /><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">{option.tag}</span></div><span className="mt-4 block text-2xl font-black text-indigo-950">AnnWord {option.title}</span><span className="mt-2 block min-h-[3rem] text-sm font-bold leading-relaxed text-gray-600">{option.description}</span><span className="mt-4 block space-y-2">{option.bullets.map(item => <span key={item} className="block rounded-2xl bg-white/75 px-3 py-2 text-xs font-bold text-gray-600">• {item}</span>)}</span><span className="mt-4 block rounded-2xl border border-white/80 bg-white/80 px-3 py-3"><span className="block text-[10px] font-black uppercase tracking-widest text-indigo-400">{s.next}</span><span className="mt-1 block text-xs font-bold leading-relaxed text-gray-600">{option.nextStep}</span></span><span className="mt-auto pt-4"><span className={`block rounded-2xl px-4 py-3 text-center text-sm font-black text-white transition ${option.button}`}>{selected === option.mode ? s.saving : option.cta}</span></span></button>)}</div></section></ScreenContainer>;
};
