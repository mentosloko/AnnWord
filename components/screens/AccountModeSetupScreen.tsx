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
  heading: 'Кто будет пользоваться?',
  hint: 'Выберите один вариант — интерфейс сразу подстроится под задачу.',
  fail: 'Не удалось сохранить выбор.',
  saving: 'Сохраняю…',
};
const OPTIONS: Array<{ mode: AccountMode; imageSrc: string; title: string; tag: string; bullets: string[]; cta: string; accent: string; button: string }> = [
  { mode: 'player', imageSrc: PRACTICE_IMAGE, title: 'Practice', tag: 'я сам', bullets: ['Быстро начать с короткой игры', 'Повторять именно сложные слова', 'Видеть личный прогресс'], cta: 'Учить слова самому', accent: 'border-indigo-100 bg-indigo-50/50 hover:border-indigo-300', button: 'bg-indigo-600 hover:bg-indigo-700' },
  { mode: 'parent', imageSrc: '/assets/onboarding/account-mode-parent.webp', title: 'Kids', tag: 'ребёнок', bullets: ['Возвращаться к словам ради игр и питомца', 'Учиться без постоянных напоминаний', 'Показывать родителю прогресс'], cta: 'Создать детский режим', accent: 'border-purple-100 bg-purple-50/50 hover:border-purple-300', button: 'bg-purple-600 hover:bg-purple-700' },
  { mode: 'teacher', imageSrc: '/assets/onboarding/account-mode-teacher.webp', title: 'Teacher', tag: 'ученики', bullets: ['Назначать свои подборки слов', 'Подключать ученика по коду', 'Видеть, что требует повторения'], cta: 'Войти как преподаватель', accent: 'border-cyan-100 bg-cyan-50/50 hover:border-cyan-300', button: 'bg-cyan-700 hover:bg-cyan-800' },
];

const getModeFromCurrentPath = (): AccountMode | null => {
  if (typeof window === 'undefined') return null;
  const audience = new URLSearchParams(window.location.search).get('audience');
  if (audience === 'practice') return 'player';
  if (audience === 'kids') return 'parent';
  if (audience === 'teacher') return 'teacher';
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
    return <ScreenContainer className="max-w-2xl pb-20 pt-16"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-8 text-center shadow-sm"><div className="mx-auto h-16 w-16 animate-pulse rounded-3xl bg-indigo-100" /><h1 className="mt-5 text-2xl font-black text-indigo-950">Настраиваю {getModeTitle(autoModeRef.current)}</h1><p className="mt-3 text-sm font-bold leading-relaxed text-gray-500">Открываю подходящий домашний экран.</p></section></ScreenContainer>;
  }

  return <ScreenContainer className="max-w-6xl pb-20 pt-4 sm:pt-6"><section className="rounded-[1.75rem] border-2 border-indigo-50 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-8"><div className="mx-auto max-w-3xl text-center"><div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 sm:text-xs">{s.welcome}</div><h1 className="mt-2 text-3xl font-black leading-tight text-indigo-950 sm:mt-3 sm:text-5xl">{s.heading}</h1><p className="mt-2 text-sm font-bold leading-relaxed text-gray-500 sm:mt-3 sm:text-base">{s.hint}</p></div>{error && <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}<div className="mt-5 grid gap-3 sm:mt-7 sm:gap-4 lg:grid-cols-3">{OPTIONS.map(option => <button key={option.mode} type="button" disabled={selected !== null} onClick={() => void choose(option.mode)} className={`flex h-full flex-col rounded-[1.5rem] border-2 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg disabled:opacity-60 sm:rounded-[2rem] sm:p-5 ${option.accent}`}><div className="flex items-center gap-3"><img src={option.imageSrc} alt="" aria-hidden="true" className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5 shadow-sm sm:h-20 sm:w-20 sm:rounded-3xl sm:p-2" draggable={false} /><div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">{option.tag}</span><span className="mt-2 block text-xl font-black text-indigo-950 sm:text-2xl">AnnWord {option.title}</span></div></div><ul className="mt-4 space-y-2">{option.bullets.map(item => <li key={item} className="flex gap-2 rounded-2xl bg-white/75 px-3 py-2 text-sm font-bold text-gray-600"><span aria-hidden="true" className="text-indigo-500">✓</span><span>{item}</span></li>)}</ul><span className="mt-auto pt-4"><span className={`block rounded-2xl px-4 py-3 text-center text-sm font-black text-white transition ${option.button}`}>{selected === option.mode ? s.saving : option.cta}</span></span></button>)}</div></section></ScreenContainer>;
};