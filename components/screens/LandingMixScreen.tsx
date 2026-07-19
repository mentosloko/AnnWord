import React, { useState } from 'react';
import { ClientEntryPath } from '../../services/clientEntryPath';
import { ScreenContainer } from '../layout/ScreenContainer';

interface LandingMixScreenProps {
  entryPath: ClientEntryPath;
  onLogin: () => void;
  onStartPractice: () => void;
  onStartKids: () => void;
  onStartTeacher: () => void;
}

const HERO_IMAGE = '/assets/landing/landing_right_corner.webp';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
type Audience = 'practice' | 'kids' | 'teacher';
type AudienceCopy = {
  eyebrow: string;
  title: string;
  promise: string;
  bullets: string[];
  cta: string;
  note: string;
  accent: string;
};
type GamePreview = { iconSrc?: string; icon?: string; title: string };

const audienceCopy: Record<Audience, AudienceCopy> = {
  practice: {
    eyebrow: 'AnnWord Practice · для себя',
    title: 'Слова запоминаются без длинных уроков',
    promise: 'Короткая игра помогает начать сразу, а ошибки сами превращаются в план повторения.',
    bullets: ['Несколько минут на тренировку', 'Видно, какие слова уже запомнились', 'Можно учить лексику под свою цель'],
    cta: 'Создать Practice-аккаунт',
    note: 'После регистрации выберите уровень и запустите первую игру.',
    accent: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20',
  },
  kids: {
    eyebrow: 'AnnWord Kids · для ребёнка',
    title: 'Ребёнок возвращается к словам ради игры',
    promise: 'Игры, питомец и понятные награды поддерживают интерес, а взрослому не приходится каждый раз напоминать о занятии.',
    bullets: ['Хочется открыть следующую игру и награду', 'Сложные слова возвращаются в повторение', 'Родитель видит прогресс без контроля каждого шага'],
    cta: 'Создать Kids-профиль',
    note: 'Взрослый добавит ребёнка, задаст PIN и поможет выбрать питомца.',
    accent: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
  },
  teacher: {
    eyebrow: 'AnnWord Teacher · для преподавателя',
    title: 'Домашняя лексика без карточек вручную',
    promise: 'Назначайте подборки и смотрите, какие слова ученику действительно трудно запомнить.',
    bullets: ['Подключение ученика по коду', 'Свои словари и задания', 'Прогресс по конкретным словам'],
    cta: 'Создать Teacher-аккаунт',
    note: 'После регистрации откроется кабинет для подключения первого ученика.',
    accent: 'bg-cyan-700 hover:bg-cyan-800 shadow-cyan-700/20',
  },
};

const benefits = [
  { icon: '⏱️', title: 'Легко начать', text: 'Одна тренировка занимает несколько минут.' },
  { icon: '🧠', title: 'Повторяется нужное', text: 'Ошибки формируют персональный список повторения.' },
  { icon: '🎮', title: 'Не надоедает', text: 'Разные игры тренируют слово по-разному.' },
  { icon: '📈', title: 'Виден результат', text: 'Статистика показывает реальный прогресс.' },
];

const games: GamePreview[] = [
  { iconSrc: '/assets/games/game_classic.webp', title: 'Классика' },
  { iconSrc: '/assets/games/game_anagrams.webp', title: 'Анаграммы' },
  { iconSrc: '/assets/games/game_sprint.webp', title: 'Спринт' },
  { iconSrc: '/assets/games/game_one_of_two.webp', title: '1 из 2' },
  { iconSrc: '/assets/games/game_memory.webp', title: 'Память' },
  { icon: '🐍', title: 'Змейка' },
];

const ModalShell: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="landing-choice-title" className="max-h-[90svh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="landing-choice-title" className="text-2xl font-black text-indigo-950 sm:text-3xl">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-black text-slate-500">×</button>
      </div>
      {children}
    </div>
  </div>
);

const AudienceChoice: React.FC<{ audience: Audience; onClick: () => void }> = ({ audience, onClick }) => {
  const copy = audienceCopy[audience];
  const icon = audience === 'practice' ? '🔥' : audience === 'kids' ? '🐾' : '🎓';
  return (
    <button type="button" onClick={onClick} className="rounded-[1.6rem] border-2 border-indigo-50 bg-slate-50 p-4 text-left transition hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-lg sm:rounded-[2rem] sm:p-5">
      <div className="flex items-center gap-3"><div className="text-3xl" aria-hidden="true">{icon}</div><h3 className="text-lg font-black text-indigo-950 sm:text-xl">{copy.eyebrow.replace(/^AnnWord /, '')}</h3></div>
      <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">{copy.promise}</p>
      <ul className="mt-3 space-y-2">{copy.bullets.map(item => <li key={item} className="flex gap-2 text-sm font-bold text-slate-600"><span aria-hidden="true" className="text-indigo-500">✓</span><span>{item}</span></li>)}</ul>
      <span className="mt-4 inline-flex rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">{copy.cta}</span>
    </button>
  );
};

export const LandingMixScreen: React.FC<LandingMixScreenProps> = ({ entryPath, onLogin, onStartPractice, onStartKids, onStartTeacher }) => {
  const [choiceOpen, setChoiceOpen] = useState(false);
  const targetedAudience: Audience | null = entryPath === 'practice' || entryPath === 'kids' || entryPath === 'teacher' ? entryPath : null;
  const targeted = targetedAudience ? audienceCopy[targetedAudience] : null;
  const startTargeted = targetedAudience === 'practice' ? onStartPractice : targetedAudience === 'kids' ? onStartKids : onStartTeacher;

  return (
    <ScreenContainer className="max-w-7xl pb-20 pt-3 sm:pt-5">
      <section className="overflow-hidden rounded-[1.75rem] border-2 border-indigo-50 bg-white shadow-sm sm:rounded-[2.25rem]">
        <div className="grid gap-5 p-4 sm:p-8 lg:grid-cols-[1fr_35rem] lg:items-center">
          <div className="py-1 sm:py-2">
            <div className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 sm:mb-4 sm:px-4 sm:py-2 sm:text-xs">{targeted?.eyebrow || 'AnnWord · игровые тренировки слов'}</div>
            <h1 className="max-w-3xl text-3xl font-black leading-[1.02] tracking-tight text-indigo-950 sm:text-6xl">{targeted?.title || 'Английские слова, которые остаются в памяти'}</h1>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">{targeted?.promise || 'Короткие игры помогают вспомнить, собрать и узнать слово. Сложное автоматически возвращается в повторение.'}</p>
            <div className="mt-5 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:gap-3">
              <button type="button" onClick={targeted ? startTargeted : () => setChoiceOpen(true)} className={`rounded-2xl px-6 py-3.5 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 sm:py-4 ${targeted?.accent || 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}>{targeted?.cta || 'Выбрать формат и начать'}</button>
              <button type="button" onClick={onLogin} className="rounded-2xl border-2 border-slate-100 bg-white px-6 py-3.5 text-base font-black text-slate-600 transition hover:bg-slate-50 sm:py-4">Войти</button>
            </div>
            {targeted && <p className="mt-3 max-w-2xl text-xs font-bold leading-relaxed text-slate-500 sm:mt-4 sm:text-sm">{targeted.note}</p>}
          </div>
          <div className="relative mx-auto hidden max-w-[36rem] overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-sky-100 via-white to-indigo-50 p-2 shadow-2xl shadow-indigo-900/10 md:block">
            <picture>
              <source media="(min-width: 768px)" srcSet={HERO_IMAGE} />
              <img src={TRANSPARENT_PIXEL} alt="AnnWord: игровые тренировки английских слов" className="block aspect-[4/3] w-full rounded-[1.9rem] object-cover object-center" loading="lazy" decoding="async" draggable={false} />
            </picture>
          </div>
        </div>

        <div className="border-y border-indigo-50 bg-gradient-to-b from-white to-indigo-50/60 px-4 py-4 sm:px-8 sm:py-7">
          <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 sm:text-xs">Сразу после входа</div><h2 className="mt-1 text-xl font-black text-indigo-950 sm:text-3xl">Выберите игру</h2></div><span className="hidden text-sm font-bold text-slate-500 sm:block">6 способов закрепить слово</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:grid-cols-6 sm:gap-3">{games.map(game => <article key={game.title} className="rounded-2xl border-2 border-white bg-white p-2 text-center shadow-sm sm:rounded-[1.5rem] sm:p-4">{game.iconSrc ? <img src={game.iconSrc} alt="" aria-hidden="true" className="mx-auto h-11 w-11 object-contain sm:h-14 sm:w-14" loading="lazy" decoding="async" draggable={false} /> : <span aria-hidden="true" className="mx-auto flex h-11 w-11 items-center justify-center text-4xl sm:h-14 sm:w-14 sm:text-5xl">{game.icon}</span>}<div className="mt-1.5 truncate text-[11px] font-black text-indigo-950 sm:mt-3 sm:text-sm">{game.title}</div></article>)}</div>
        </div>

        <div className="hidden gap-3 bg-slate-50/70 p-5 sm:grid sm:grid-cols-4">
          {benefits.map(item => <div key={item.title} className="rounded-3xl bg-white px-4 py-4 shadow-sm"><div className="text-2xl" aria-hidden="true">{item.icon}</div><h3 className="mt-2 text-base font-black text-indigo-950">{item.title}</h3><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{item.text}</p></div>)}
        </div>

        <div className="grid gap-3 p-4 sm:gap-4 sm:p-8 lg:grid-cols-3">
          <AudienceChoice audience="practice" onClick={onStartPractice} />
          <AudienceChoice audience="kids" onClick={onStartKids} />
          <AudienceChoice audience="teacher" onClick={onStartTeacher} />
        </div>
      </section>

      {choiceOpen && <ModalShell title="Кто будет пользоваться AnnWord?" onClose={() => setChoiceOpen(false)}><div className="grid gap-4 lg:grid-cols-3"><AudienceChoice audience="practice" onClick={() => { setChoiceOpen(false); onStartPractice(); }} /><AudienceChoice audience="kids" onClick={() => { setChoiceOpen(false); onStartKids(); }} /><AudienceChoice audience="teacher" onClick={() => { setChoiceOpen(false); onStartTeacher(); }} /></div></ModalShell>}
    </ScreenContainer>
  );
};
