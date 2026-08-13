import React, { useEffect } from 'react';
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
type GamePreview = { iconSrc?: string; icon?: string; title: string };

const games: GamePreview[] = [
  { iconSrc: '/assets/games/game_classic.webp', title: 'Классика' },
  { iconSrc: '/assets/games/game_anagrams.webp', title: 'Анаграммы' },
  { iconSrc: '/assets/games/game_sprint.webp', title: 'Спринт' },
  { iconSrc: '/assets/games/game_one_of_two.webp', title: '1 из 2' },
  { iconSrc: '/assets/games/game_memory.webp', title: 'Память' },
  { icon: '🐍', title: 'Змейка' },
];

const parentSteps = [
  { number: '1', title: 'Добавьте школьные слова', text: 'Введите слова из домашнего задания, учебника или списка преподавателя.' },
  { number: '2', title: 'Ребёнок играет', text: 'Одни и те же слова встречаются в разных игровых механиках и запоминаются без зубрёжки.' },
  { number: '3', title: 'Смотрите реальный прогресс', text: 'Сложные слова возвращаются в повторение, а в кабинете видно, что уже получается.' },
];

const parentBenefits = [
  { icon: '🎒', title: 'Именно школьные слова', text: 'Не абстрактный курс: ребёнок тренирует ту лексику, которую нужно выучить сейчас.' },
  { icon: '🎮', title: 'Меньше уговоров', text: 'Игры, питомец и награды превращают повторение слов в понятную ежедневную цель.' },
  { icon: '🧠', title: 'Сложное повторяется', text: 'Ошибки не теряются: трудные слова автоматически получают дополнительную практику.' },
  { icon: '📈', title: 'Родитель видит результат', text: 'Можно проверить прогресс, не контролируя каждую минуту занятия.' },
];

const teacherBenefits = [
  { icon: '🔗', title: 'Подключение по коду', text: 'Родитель создаёт код ребёнка, а преподаватель подключает ученика в своём кабинете.' },
  { icon: '📚', title: 'Свои подборки слов', text: 'Назначайте ученику лексику к следующему уроку без карточек и переписки.' },
  { icon: '📊', title: 'Прогресс по словам', text: 'Видно, какие слова уже закрепились, а где ребёнку нужна дополнительная практика.' },
];

const GameStrip = () => (
  <div className="border-y border-indigo-50 bg-gradient-to-b from-white to-indigo-50/60 px-4 py-5 sm:px-8 sm:py-7">
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 sm:text-xs">Учёба превращается в игру</div>
        <h2 className="mt-1 text-xl font-black text-indigo-950 sm:text-3xl">Одни слова — разные способы запомнить</h2>
      </div>
      <span className="hidden text-sm font-bold text-slate-500 sm:block">6 игровых механик</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:grid-cols-6 sm:gap-3">
      {games.map(game => <article key={game.title} className="rounded-2xl border-2 border-white bg-white p-2 text-center shadow-sm sm:rounded-[1.5rem] sm:p-4">{game.iconSrc ? <img src={game.iconSrc} alt="" aria-hidden="true" className="mx-auto h-11 w-11 object-contain sm:h-14 sm:w-14" loading="lazy" decoding="async" draggable={false} /> : <span aria-hidden="true" className="mx-auto flex h-11 w-11 items-center justify-center text-4xl sm:h-14 sm:w-14 sm:text-5xl">{game.icon}</span>}<div className="mt-1.5 truncate text-[11px] font-black text-indigo-950 sm:mt-3 sm:text-sm">{game.title}</div></article>)}
    </div>
  </div>
);

const LegacyLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <ScreenContainer className="max-w-3xl pb-20 pt-10 sm:pt-16">
    <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 text-center shadow-sm sm:p-10">
      <div className="text-xs font-black uppercase tracking-widest text-indigo-400">AnnWord · существующий аккаунт</div>
      <h1 className="mt-3 text-3xl font-black text-indigo-950 sm:text-5xl">Продолжить обучение</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-relaxed text-slate-600 sm:text-base">Если вы уже пользовались AnnWord раньше, войдите в свой аккаунт — ваш прогресс и привычный режим сохранятся.</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onLogin} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700">Войти</button>
        <a href="/" className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">На главную</a>
      </div>
    </section>
  </ScreenContainer>
);

export const LandingMixScreen: React.FC<LandingMixScreenProps> = ({ entryPath, onLogin, onStartKids, onStartTeacher }) => {
  const isTeacherLanding = entryPath === 'teacher';
  const isLegacyLogin = entryPath === 'practice';

  useEffect(() => {
    if (entryPath !== 'landing_mix' || typeof window === 'undefined') return;
    window.history.replaceState({}, '', '/');
  }, [entryPath]);

  if (isLegacyLogin) return <LegacyLogin onLogin={onLogin} />;

  if (isTeacherLanding) {
    return (
      <ScreenContainer className="max-w-7xl pb-20 pt-3 sm:pt-5">
        <section className="overflow-hidden rounded-[1.75rem] border-2 border-cyan-50 bg-white shadow-sm sm:rounded-[2.25rem]">
          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_30rem] lg:items-center">
            <div>
              <div className="inline-flex rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-700">AnnWord для преподавателей</div>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-[1.03] tracking-tight text-indigo-950 sm:text-6xl">Ученики повторяют заданные вами слова между занятиями</h1>
              <p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-slate-600 sm:text-lg">Подключайте детей, назначайте подборки и смотрите, какие слова требуют повторения. Игровая часть остаётся у ребёнка, контроль — у вас и родителя.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onStartTeacher} className="rounded-2xl bg-cyan-700 px-6 py-4 font-black text-white shadow-lg shadow-cyan-700/20 transition hover:-translate-y-0.5 hover:bg-cyan-800">Создать аккаунт преподавателя</button>
                <button type="button" onClick={onLogin} className="rounded-2xl border-2 border-slate-100 bg-white px-6 py-4 font-black text-slate-600 transition hover:bg-slate-50">Войти</button>
              </div>
            </div>
            <div className="rounded-[2rem] bg-gradient-to-br from-cyan-50 to-indigo-50 p-5 sm:p-7">
              <div className="text-sm font-black uppercase tracking-widest text-cyan-700">Как это работает</div>
              <ol className="mt-4 space-y-3">
                <li className="rounded-2xl bg-white p-4 font-bold text-slate-600"><span className="mr-2 font-black text-cyan-700">1.</span>Родитель создаёт детский аккаунт и код подключения.</li>
                <li className="rounded-2xl bg-white p-4 font-bold text-slate-600"><span className="mr-2 font-black text-cyan-700">2.</span>Вы добавляете ученика и назначаете слова.</li>
                <li className="rounded-2xl bg-white p-4 font-bold text-slate-600"><span className="mr-2 font-black text-cyan-700">3.</span>Ребёнок играет, а вы видите прогресс.</li>
              </ol>
            </div>
          </div>
          <div className="grid gap-3 bg-slate-50/70 p-5 sm:grid-cols-3 sm:p-8">{teacherBenefits.map(item => <article key={item.title} className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-3xl" aria-hidden="true">{item.icon}</div><h2 className="mt-3 text-lg font-black text-indigo-950">{item.title}</h2><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{item.text}</p></article>)}</div>
          <div className="p-5 text-center sm:p-8"><a href="/" className="text-sm font-black text-indigo-600 transition hover:text-indigo-800">← Вернуться на AnnWord для родителей</a></div>
        </section>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="max-w-7xl pb-20 pt-3 sm:pt-5">
      <section className="overflow-hidden rounded-[1.75rem] border-2 border-indigo-50 bg-white shadow-sm sm:rounded-[2.25rem]">
        <div className="grid gap-5 p-4 sm:p-8 lg:grid-cols-[1fr_35rem] lg:items-center">
          <div className="py-1 sm:py-2">
            <div className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 sm:mb-4 sm:px-4 sm:py-2 sm:text-xs">AnnWord · английские слова для школьников</div>
            <h1 className="max-w-3xl text-3xl font-black leading-[1.02] tracking-tight text-indigo-950 sm:text-6xl">Задали английские слова? Пусть ребёнок выучит их играючи.</h1>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">Добавьте слова из школьного задания — AnnWord превратит их в игры, будет возвращать сложные слова и покажет вам прогресс.</p>
            <div className="mt-5 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:gap-3">
              <button type="button" onClick={onStartKids} className="rounded-2xl bg-emerald-600 px-6 py-3.5 text-base font-black text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 sm:py-4">Начать бесплатно</button>
              <button type="button" onClick={onLogin} className="rounded-2xl border-2 border-slate-100 bg-white px-6 py-3.5 text-base font-black text-slate-600 transition hover:bg-slate-50 sm:py-4">Войти</button>
            </div>
            <p className="mt-3 max-w-2xl text-xs font-bold leading-relaxed text-slate-500 sm:mt-4 sm:text-sm">Аккаунт создаёт взрослый. Затем ребёнок получает свой профиль, PIN и выбирает питомца.</p>
          </div>
          <div className="relative mx-auto hidden max-w-[36rem] overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-2 shadow-2xl shadow-indigo-900/10 md:block">
            <picture>
              <source media="(min-width: 768px)" srcSet={HERO_IMAGE} />
              <img src={TRANSPARENT_PIXEL} alt="AnnWord помогает ребёнку учить заданные английские слова через игры" className="block aspect-[4/3] w-full rounded-[1.9rem] object-cover object-center" loading="lazy" decoding="async" draggable={false} />
            </picture>
          </div>
        </div>

        <GameStrip />

        <div className="p-4 sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Три шага</div>
            <h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-4xl">От домашнего задания до выученных слов</h2>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">{parentSteps.map(step => <article key={step.number} className="rounded-[1.75rem] border-2 border-indigo-50 bg-indigo-50/30 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white">{step.number}</div><h3 className="mt-4 text-xl font-black text-indigo-950">{step.title}</h3><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{step.text}</p></article>)}</div>
        </div>

        <div className="grid gap-3 bg-slate-50/70 p-5 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">{parentBenefits.map(item => <article key={item.title} className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-3xl" aria-hidden="true">{item.icon}</div><h3 className="mt-3 text-base font-black text-indigo-950">{item.title}</h3><p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{item.text}</p></article>)}</div>

        <div className="p-5 text-center sm:p-9">
          <h2 className="text-2xl font-black text-indigo-950 sm:text-4xl">Начните со слов, которые задали сегодня</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-relaxed text-slate-500 sm:text-base">Создайте аккаунт родителя, добавьте ребёнка и запустите первую игровую тренировку.</p>
          <button type="button" onClick={onStartKids} className="mt-5 rounded-2xl bg-emerald-600 px-7 py-4 font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">Создать аккаунт</button>
        </div>
      </section>
    </ScreenContainer>
  );
};
