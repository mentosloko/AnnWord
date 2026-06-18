import React from 'react';
import { ClientEntryPath } from '../../services/clientEntryPath';
import { ScreenContainer } from '../layout/ScreenContainer';

type PublicModeEntryPath = Exclude<ClientEntryPath, 'home' | 'landing_mix'>;

interface ModeEntryScreenProps {
  entryPath: PublicModeEntryPath;
  isAuthenticated: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onBackHome: () => void;
}

const copy: Record<PublicModeEntryPath, { title: string; eyebrow: string; description: string; imageSrc: string; bullets: string[]; cta: string }> = {
  practice: {
    title: 'AnnWord Practice',
    eyebrow: 'Для самостоятельной практики',
    description: 'Тренируйте английские слова в коротких игровых режимах: классика, анаграммы, спринт, память, виселица, 1 из 2 и квадрат слов.',
    imageSrc: '/assets/branding/annword-logo-mark.svg',
    bullets: ['Ежедневные задания и streak', 'Статистика ошибок и слов к повторению', 'Premium и собственные словари'],
    cta: 'Создать Practice-аккаунт',
  },
  kids: {
    title: 'AnnWord Kids',
    eyebrow: 'Для ребёнка и родителя',
    description: 'Детский режим с питомцем, монетами, магазином, заданиями и родительским кабинетом.',
    imageSrc: '/assets/onboarding/account-mode-parent.webp',
    bullets: ['Игровой профиль ребёнка', 'Питомец и награды', 'Кабинет родителя и код для преподавателя'],
    cta: 'Создать Kids-профиль',
  },
  teacher: {
    title: 'AnnWord Teacher',
    eyebrow: 'Для преподавателя',
    description: 'Кабинет для работы с учениками, словарями и учебными подборками.',
    imageSrc: '/assets/onboarding/account-mode-teacher.webp',
    bullets: ['Подключение учеников по коду', 'Словари преподавателя', 'Просмотр прогресса'],
    cta: 'Создать Teacher-аккаунт',
  },
};

export const ModeEntryScreen: React.FC<ModeEntryScreenProps> = ({ entryPath, isAuthenticated, onLogin, onRegister, onBackHome }) => {
  const item = copy[entryPath];
  return <ScreenContainer className="max-w-6xl pb-20 pt-6"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm sm:p-8"><div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-center"><div><button type="button" onClick={onBackHome} className="mb-6 rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">← Все режимы</button><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{item.eyebrow}</div><h1 className="mt-3 text-4xl font-black leading-tight text-indigo-950 sm:text-6xl">{item.title}</h1><p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-gray-600 sm:text-lg">{item.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{item.bullets.map(bullet => <div key={bullet} className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-800">{bullet}</div>)}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onRegister} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700">{isAuthenticated ? 'Настроить режим аккаунта' : item.cta}</button><button type="button" onClick={onLogin} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">Войти</button></div>{isAuthenticated && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Вы уже вошли. Если нужен другой режим, выберите его в настройке аккаунта или выйдите и создайте отдельный профиль.</p>}</div><aside className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-sky-600 p-6 text-white shadow-xl"><img src={item.imageSrc} alt="" aria-hidden="true" className="mx-auto h-44 w-44 rounded-[2rem] bg-white/15 object-contain p-4" draggable={false} /><div className="mt-6 text-2xl font-black">Отдельный адрес</div><div className="mt-2 rounded-2xl bg-white/15 px-4 py-3 font-mono text-sm font-black">/{entryPath}</div><p className="mt-4 text-sm font-bold leading-relaxed text-white/75">Эту страницу можно давать напрямую нужной аудитории.</p></aside></div></section></ScreenContainer>;
};