import React from 'react';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ModeGatewayScreenProps {
  onOpenPractice: () => void;
  onOpenKids: () => void;
  onOpenTeacher: () => void;
}

const cards = [
  { key: 'practice', title: 'Practice', subtitle: 'Для самостоятельной практики', description: 'Ежедневные тренировки, статистика, словари и быстрые игры для взрослых учеников.', imageSrc: '/assets/branding/annword-logo-mark.svg', cta: 'Перейти в Practice' },
  { key: 'kids', title: 'Kids', subtitle: 'Для ребёнка и родителя', description: 'Игры, питомец, монеты, задания и родительский кабинет для контроля прогресса.', imageSrc: '/assets/onboarding/account-mode-parent.webp', cta: 'Перейти в Kids' },
  { key: 'teacher', title: 'Teacher', subtitle: 'Для преподавателя', description: 'Кабинет преподавателя: ученики, словари, назначение материалов и наблюдение за прогрессом.', imageSrc: '/assets/onboarding/account-mode-teacher.webp', cta: 'Перейти в Teacher' },
] as const;

export const ModeGatewayScreen: React.FC<ModeGatewayScreenProps> = ({ onOpenPractice, onOpenKids, onOpenTeacher }) => {
  const actions = { practice: onOpenPractice, kids: onOpenKids, teacher: onOpenTeacher } as const;
  return <ScreenContainer className="max-w-7xl pb-20 pt-6"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm sm:p-8"><div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">AnnWord</div><h1 className="mt-3 text-4xl font-black leading-tight text-indigo-950 sm:text-6xl">Выберите свой вход</h1><p className="mt-4 text-base font-bold leading-relaxed text-gray-600 sm:text-lg">Главная страница теперь только разводит по трём сценариям: самостоятельная практика, детский режим и кабинет преподавателя.</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{cards.map(card => <button key={card.key} type="button" onClick={actions[card.key]} className="group flex min-h-[20rem] flex-col rounded-[2rem] border-2 border-indigo-50 bg-gradient-to-br from-white to-indigo-50/50 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-100 hover:shadow-xl"><img src={card.imageSrc} alt="" aria-hidden="true" className="h-24 w-24 rounded-3xl bg-white object-contain p-2 shadow-sm transition group-hover:scale-105" draggable={false} /><div className="mt-5 text-3xl font-black text-indigo-950">{card.title}</div><div className="mt-1 text-sm font-black text-indigo-600">{card.subtitle}</div><p className="mt-4 flex-1 text-sm font-bold leading-relaxed text-gray-500">{card.description}</p><span className="mt-5 inline-flex w-max rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white transition group-hover:bg-indigo-700">{card.cta}</span></button>)}</div></section></ScreenContainer>;
};