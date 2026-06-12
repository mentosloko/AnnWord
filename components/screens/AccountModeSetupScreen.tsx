import React, { useState } from 'react';
import { AccountMode } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface AccountModeSetupScreenProps { onSelectMode: (mode: AccountMode) => Promise<void>; }
const PRACTICE_IMAGE = '/assets/onboarding/account-mode-practice-dog.webp';
const s = {
  welcome: 'Добро пожаловать в AnnWord',
  heading: 'Выберите формат AnnWord',
  hint: 'Это три разных сценария с разным интерфейсом и функциями.',
  fail: 'Не удалось сохранить выбор.',
  saving: 'Сохраняю…',
};
const OPTIONS: Array<{ mode: AccountMode; imageSrc: string; title: string; description: string; bullets: string[]; cta: string; accent: string }> = [
  { mode: 'player', imageSrc: PRACTICE_IMAGE, title: 'AnnWord Practice', description: 'Для взрослого, который сам тренирует английские слова.', bullets: ['Ежедневная практика без питомцев и монет', 'Уровни сложности и тематические словари', 'Premium для кастомных и специальных словарей'], cta: 'Учить слова самому', accent: 'border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50' },
  { mode: 'parent', imageSrc: '/assets/onboarding/account-mode-parent.webp', title: 'AnnWord Kids', description: 'Геймифицированное обучение: аккаунт создаёт взрослый, играет ребёнок.', bullets: ['Питомец, монеты, лакомства и задания', 'Кабинет родителя и Premium взрослого', 'Код ребёнка для преподавателя и его словарей'], cta: 'Создать детский режим', accent: 'border-purple-100 hover:border-purple-300 hover:bg-purple-50' },
  { mode: 'teacher', imageSrc: '/assets/onboarding/account-mode-teacher.webp', title: 'Кабинет преподавателя', description: 'Рабочий кабинет без игр и детской экономики.', bullets: ['Подключение учеников по коду', 'Просмотр прогресса', 'Создание и назначение словарей'], cta: 'Войти как преподаватель', accent: 'border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50' },
];
export const AccountModeSetupScreen: React.FC<AccountModeSetupScreenProps> = ({ onSelectMode }) => {
  const [selected, setSelected] = useState<AccountMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (mode: AccountMode) => { setSelected(mode); setError(null); try { await onSelectMode(mode); } catch (problem: unknown) { setSelected(null); setError(problem instanceof Error ? problem.message : s.fail); } };
  return <ScreenContainer className="max-w-5xl pb-20 pt-8"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm sm:p-8"><div className="text-center text-xs font-black uppercase tracking-widest text-indigo-400">{s.welcome}</div><h1 className="mt-3 text-center text-3xl font-black text-indigo-950 sm:text-4xl">{s.heading}</h1><p className="mx-auto mt-3 max-w-2xl text-center text-sm font-bold text-gray-500 sm:text-base">{s.hint}</p>{error && <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}<div className="mt-7 grid gap-4 lg:grid-cols-3">{OPTIONS.map(option => <button key={option.mode} type="button" disabled={selected !== null} onClick={() => void choose(option.mode)} className={`flex h-full flex-col rounded-3xl border-2 p-4 text-left transition disabled:opacity-60 ${option.accent}`}><img src={option.imageSrc} alt="" aria-hidden="true" className="mx-auto h-28 w-28 rounded-3xl bg-indigo-50 object-contain" draggable={false} /><span className="mt-3 block text-xl font-black text-indigo-950">{option.title}</span><span className="mt-2 block text-sm font-bold leading-relaxed text-gray-600">{option.description}</span><span className="mt-4 block space-y-2">{option.bullets.map(item => <span key={item} className="block rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold text-gray-500">• {item}</span>)}</span><span className="mt-auto pt-4"><span className="block rounded-2xl bg-indigo-600 px-4 py-3 text-center text-sm font-black text-white">{selected === option.mode ? s.saving : option.cta}</span></span></button>)}</div></section></ScreenContainer>;
};
