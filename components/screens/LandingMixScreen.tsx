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

type Audience = 'practice' | 'kids' | 'teacher';

type AudienceCopy = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  note: string;
  accent: string;
};

const audienceCopy: Record<Audience, AudienceCopy> = {
  practice: {
    eyebrow: 'AnnWord Practice · самостоятельная практика',
    title: 'Регулярно повторяйте английские слова без длинных уроков',
    body: 'Короткие игровые тренировки, ежедневные задания, статистика ошибок и тематические словари помогают взрослому заниматься самостоятельно и видеть, какие слова действительно требуют повторения.',
    cta: 'Создать Practice-аккаунт',
    note: 'После регистрации вы выберете уровень и сможете сразу запустить первую тренировку.',
    accent: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20',
  },
  kids: {
    eyebrow: 'AnnWord Kids · ребёнок и родитель',
    title: 'Учите слова через игру, питомца и понятные награды',
    body: 'Ребёнок играет и заботится о питомце, а взрослый управляет профилем, видит прогресс и при необходимости связывает домашнюю практику с заданиями преподавателя.',
    cta: 'Создать Kids-профиль',
    note: 'После регистрации взрослый добавит ребёнка, создаст PIN и поможет выбрать персонажа.',
    accent: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
  },
  teacher: {
    eyebrow: 'AnnWord Teacher · кабинет преподавателя',
    title: 'Назначайте ученикам словари и отслеживайте сложные слова',
    body: 'Преподаватель подключает ученика по коду родителя, создаёт учебные подборки, назначает их и видит статистику домашних тренировок без детской экономики и игровых отвлечений.',
    cta: 'Создать Teacher-аккаунт',
    note: 'После регистрации откроется рабочий кабинет для подключения первого ученика.',
    accent: 'bg-cyan-700 hover:bg-cyan-800 shadow-cyan-700/20',
  },
};

const benefits = [
  { icon: '⏱️', title: 'Коротко', text: 'Одна тренировка занимает несколько минут: легко начать сегодня и вернуться завтра.' },
  { icon: '🧠', title: 'Эффективно', text: 'Слова закрепляются через активное вспоминание, а не пассивное пролистывание карточек.' },
  { icon: '🎮', title: 'Интересно', text: 'Разные игровые режимы удерживают внимание и не дают практике превратиться в рутину.' },
  { icon: '📈', title: 'Персонально', text: 'Ошибки становятся планом повторения, а статистика показывает реальный прогресс.' },
];

const games = [
  { iconSrc: '/assets/games/game_classic.webp', title: 'Классика', tag: 'вспомнить по буквам' },
  { iconSrc: '/assets/games/game_anagrams.webp', title: 'Анаграммы', tag: 'собрать форму слова' },
  { iconSrc: '/assets/games/game_sprint.webp', title: 'Спринт', tag: 'быстро узнать перевод' },
  { iconSrc: '/assets/games/game_one_of_two.webp', title: '1 из 2', tag: 'отличить похожее' },
  { iconSrc: '/assets/games/game_memory.webp', title: 'Память', tag: 'связать слово и смысл' },
  { iconSrc: '/assets/games/line_game.webp', title: 'Змейка', tag: 'найти путь по буквам' },
];

const ModalShell: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="landing-choice-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:p-7">
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
    <button type="button" onClick={onClick} className="rounded-[2rem] border-2 border-indigo-50 bg-slate-50 p-5 text-left transition hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-lg">
      <div className="text-4xl" aria-hidden="true">{icon}</div>
      <h3 className="mt-4 text-xl font-black text-indigo-950">{copy.eyebrow.replace(/^AnnWord /, '')}</h3>
      <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{copy.body}</p>
      <span className="mt-5 inline-flex rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">{copy.cta}</span>
    </button>
  );
};

export const LandingMixScreen: React.FC<LandingMixScreenProps> = ({ entryPath, onLogin, onStartPractice, onStartKids, onStartTeacher }) => {
  const [choiceOpen, setChoiceOpen] = useState(false);
  const targetedAudience: Audience | null = entryPath === 'practice' || entryPath === 'kids' || entryPath === 'teacher' ? entryPath : null;
  const targeted = targetedAudience ? audienceCopy[targetedAudience] : null;
  const startTargeted = targetedAudience === 'practice' ? onStartPractice : targetedAudience === 'kids' ? onStartKids : onStartTeacher;

  return (
    <ScreenContainer className="max-w-7xl pb-24 pt-5">
      <section className="overflow-hidden rounded-[2.25rem] border-2 border-indigo-50 bg-white shadow-sm">
        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_35rem] lg:items-center">
          <div className="py-2">
            <div className="mb-4 inline-flex rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-500">{targeted?.eyebrow || 'AnnWord · активная тренировка слов'}</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-tight text-indigo-950 sm:text-6xl">{targeted?.title || 'Английские слова, которые остаются в памяти'}</h1>
            <p className="mt-5 max-w-2xl text-base font-bold leading-relaxed text-slate-600 sm:text-lg">{targeted?.body || 'AnnWord превращает лексику в короткие игровые тренировки. Слова нужно вспомнить, собрать, узнать и повторить — так практика становится понятной привычкой для взрослых и увлекательной игрой для детей.'}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={targeted ? startTargeted : () => setChoiceOpen(true)} className={`rounded-2xl px-6 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 ${targeted?.accent || 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}>{targeted?.cta || 'Выбрать формат и начать'}</button>
              <button type="button" onClick={onLogin} className="rounded-2xl border-2 border-slate-100 bg-white px-6 py-4 text-base font-black text-slate-600 transition hover:bg-slate-50">Войти</button>
            </div>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">{targeted?.note || 'Сначала выберите, кто будет пользоваться AnnWord. Регистрация откроется только после понятного выбора формата.'}</p>
          </div>
          <div className="relative mx-auto max-w-[36rem] overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-sky-100 via-white to-indigo-50 p-2 shadow-2xl shadow-indigo-900/10">
            <img src={HERO_IMAGE} alt="AnnWord: игровые тренировки английских слов" className="block aspect-[4/3] w-full rounded-[1.9rem] object-cover object-center" draggable={false} />
          </div>
        </div>

        <div className="grid gap-3 border-y border-indigo-50 bg-slate-50/70 p-4 sm:grid-cols-4 sm:p-5">
          {benefits.map(item => <div key={item.title} className="rounded-3xl bg-white px-4 py-4 shadow-sm"><div className="text-2xl" aria-hidden="true">{item.icon}</div><h3 className="mt-2 text-base font-black text-indigo-950">{item.title}</h3><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{item.text}</p></div>)}
        </div>

        <div className="grid gap-4 p-5 sm:p-8 lg:grid-cols-3">
          <AudienceChoice audience="practice" onClick={onStartPractice} />
          <AudienceChoice audience="kids" onClick={onStartKids} />
          <AudienceChoice audience="teacher" onClick={onStartTeacher} />
        </div>

        <div className="bg-gradient-to-b from-white to-indigo-50/60 px-5 pb-8 sm:px-8">
          <div className="mx-auto max-w-3xl text-center"><h2 className="text-2xl font-black text-indigo-950 sm:text-3xl">6 игр — 6 способов закрепить слово</h2><p className="mt-3 text-sm font-bold leading-relaxed text-slate-500 sm:text-base">Игры тренируют написание, перевод, внимательность и связь между словом и смыслом.</p></div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{games.map(game => <article key={game.title} className="rounded-[1.5rem] border-2 border-white bg-white p-4 text-center shadow-sm"><img src={game.iconSrc} alt="" aria-hidden="true" className="mx-auto h-14 w-14 object-contain" draggable={false} /><div className="mt-3 text-sm font-black text-indigo-950">{game.title}</div><div className="mt-1 text-[10px] font-black uppercase tracking-wide text-indigo-400">{game.tag}</div></article>)}</div>
        </div>
      </section>

      {choiceOpen && <ModalShell title="Кто будет пользоваться AnnWord?" onClose={() => setChoiceOpen(false)}><div className="grid gap-4 lg:grid-cols-3"><AudienceChoice audience="practice" onClick={() => { setChoiceOpen(false); onStartPractice(); }} /><AudienceChoice audience="kids" onClick={() => { setChoiceOpen(false); onStartKids(); }} /><AudienceChoice audience="teacher" onClick={() => { setChoiceOpen(false); onStartTeacher(); }} /></div></ModalShell>}
    </ScreenContainer>
  );
};
