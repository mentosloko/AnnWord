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

const FINAL_ASSET = '/assets/landing/final';
const asset = (name: string) => `${FINAL_ASSET}/${name}`;

const PawMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`inline-block h-[0.9em] w-[0.9em] ${className}`} fill="currentColor">
    <ellipse cx="12" cy="15.2" rx="5.1" ry="4.2" />
    <circle cx="6.2" cy="10.2" r="2.1" />
    <circle cx="10.1" cy="6.8" r="2.15" />
    <circle cx="14.4" cy="6.8" r="2.15" />
    <circle cx="18" cy="10.3" r="2.05" />
  </svg>
);

const problemCards = [
  { title: 'Скучно и утомительно', text: 'Монотонные списки быстро утомляют и отбивают интерес.' },
  { title: 'Слова забываются', text: 'Нет практики в контексте — слова не остаются в памяти.' },
  { title: 'Оценки давят', text: 'Страх ошибок и оценок снижает мотивацию.' },
  { title: 'Родителям сложно', text: 'Непонятно, как помочь и есть ли результат.' },
];

const parentSteps = [
  { title: 'Добавляете школьные слова', text: 'Загрузите список или добавьте слова вручную. Укажите перевод и контекст.' },
  { title: 'Ребёнок играет и учит слова', text: 'Короткие игровые сессии помогают понять, запомнить и применять слова.' },
  { title: 'Вы видите прогресс', text: 'Отчёты и статистика показывают, что уже получается и где нужна помощь.' },
];

const teacherBenefits = [
  { icon: '🔗', title: 'Подключение по коду', text: 'Родитель создаёт код ребёнка, а преподаватель подключает ученика в своём кабинете.' },
  { icon: '📚', title: 'Свои подборки слов', text: 'Назначайте ученику лексику к следующему уроку без карточек и переписки.' },
  { icon: '📊', title: 'Прогресс по словам', text: 'Видно, какие слова уже закрепились, а где ребёнку нужна дополнительная практика.' },
];

const trustItems = [
  { icon: '⏱', title: 'Короткие игровые сессии', text: '' },
  { icon: '⊘', title: 'Без рекламы — гарантировано', text: '' },
  { icon: '◆', title: 'Безопасная среда', text: '' },
  { icon: '↗', title: 'Понятный прогресс для родителей', text: '' },
];

const childBenefits = [
  'Учит школьные слова в игре',
  'Лучше запоминает и понимает слова',
  'Повышает уверенность и мотивацию',
  'Получает награды и растит питомца',
  'Видит свой прогресс каждый день',
];

const parentBenefits = [
  'Видите реальный прогресс и статистику',
  'Экономите время и нервы',
  'Понимаете, какие слова даются труднее',
  'Спокойны: приложение без рекламы',
  'Ребёнок учится с удовольствием',
];

const WordlePreview = () => {
  const rows = [
    [['A', 'bg-slate-400 text-white'], ['P', 'bg-amber-400 text-white'], ['P', 'bg-amber-400 text-white'], ['L', 'bg-slate-400 text-white'], ['E', 'bg-slate-400 text-white']],
    [['P', 'bg-slate-400 text-white'], ['L', 'bg-emerald-500 text-white'], ['A', 'bg-amber-400 text-white'], ['N', 'bg-slate-400 text-white'], ['E', 'bg-emerald-500 text-white']],
    [['A', 'bg-emerald-500 text-white'], ['P', 'bg-emerald-500 text-white'], ['P', 'bg-emerald-500 text-white'], ['L', 'bg-emerald-500 text-white'], ['E', 'bg-emerald-500 text-white']],
  ];
  return (
    <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-violet-50 via-white to-violet-50 p-3 shadow-inner">
      <div className="grid grid-cols-5 gap-1.5">{rows.flatMap((row, rowIndex) => row.map(([letter, tone], colIndex) => <div key={`${rowIndex}-${colIndex}`} className={`flex aspect-square items-center justify-center rounded-lg text-sm font-black shadow-sm ${tone}`}>{letter}</div>))}</div>
      <div className="mt-3 space-y-1">{['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map(row => <div key={row} className="flex justify-center gap-0.5">{row.split('').map(letter => <span key={letter} className={`flex h-5 min-w-4 items-center justify-center rounded text-[7px] font-black ${'APPLE'.includes(letter) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'}`}>{letter}</span>)}</div>)}</div>
    </div>
  );
};

const HangmanPreview = () => {
  const guessed = new Set(['S', 'C', 'O', 'L']);
  return (
    <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-blue-50 via-white to-blue-50 p-3 shadow-inner">
      <div className="flex justify-center gap-0.5 text-base" aria-label="Осталось семь попыток">{Array.from({ length: 7 }).map((_, index) => <span key={index}>❤️</span>)}</div>
      <div className="mt-3 flex justify-center gap-1.5">{'SCHOOL'.split('').map((letter, index) => <div key={`${letter}-${index}`} className="flex h-8 w-6 items-center justify-center border-b-2 border-indigo-500 text-sm font-black text-indigo-950">{guessed.has(letter) ? letter : ''}</div>)}</div>
      <div className="mt-3 grid grid-cols-7 gap-1">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <span key={letter} className={`flex h-5 items-center justify-center rounded text-[7px] font-black ${guessed.has(letter) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'}`}>{letter}</span>)}</div>
    </div>
  );
};

const AnagramPreview = () => (
  <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-orange-50 via-white to-amber-50 p-3 text-center shadow-inner">
    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Перевод</div>
    <div className="mt-0.5 text-lg font-black text-indigo-950">тигр</div>
    <div className="mt-3 grid grid-cols-5 gap-1.5 rounded-xl border-2 border-dashed border-orange-100 bg-white/80 p-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="aspect-square rounded-md bg-orange-50 shadow-inner" />)}</div>
    <div className="mt-3 grid grid-cols-5 gap-1.5">{'GITER'.split('').map((letter, index) => <div key={`${letter}-${index}`} className="flex aspect-square items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white shadow-md">{letter}</div>)}</div>
    <div className="mt-auto pt-2 text-[9px] font-black text-rose-500">Не знаю</div>
  </div>
);

const SprintPreview = () => (
  <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-emerald-50 via-white to-green-50 p-3 shadow-inner">
    <div className="flex justify-end"><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-600 shadow-sm">⏱ 42с</span></div>
    <div className="mt-2 text-center"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Как будет по-английски?</div><div className="mt-1 text-xl font-black text-indigo-950">книга</div></div>
    <div className="mt-3 space-y-1.5">{['book', 'pencil', 'school', 'window'].map((option, index) => <div key={option} className={`rounded-xl border px-3 py-2 text-center text-xs font-black shadow-sm ${index === 0 ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-100 bg-white text-slate-600'}`}>{option}</div>)}</div>
  </div>
);

const SnakePreview = () => {
  const cells = ['M','A','P','L','E','T','B','O','O','K','S','H','I','P','D','F','R','I','E','N','C','A','T','S','Y'];
  const selected = new Map([[6, 1], [7, 2], [8, 3], [9, 4]]);
  return (
    <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-rose-50 via-white to-pink-50 p-3 shadow-inner">
      <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm"><div className="text-sm font-black text-indigo-950">книга</div><div className="mt-0.5 text-[8px] font-bold text-slate-400">4 буквы · соседние клетки</div></div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">{cells.map((letter, index) => { const order = selected.get(index); return <div key={`${letter}-${index}`} className={`relative flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-black shadow-sm ${order ? 'border-blue-500 bg-blue-100 text-blue-950' : 'border-amber-100 bg-white text-slate-700'}`}>{letter}{order && <span className="absolute left-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white">{order}</span>}</div>; })}</div>
      <div className="mt-2 text-center text-[8px] font-bold leading-tight text-indigo-500">Соберите слово из соседних клеток. Диагонали нельзя.</div>
    </div>
  );
};

const gameCards = [
  { title: 'Вордл', subtitle: 'Угадай слово за 6 попыток', tone: 'from-violet-500 to-purple-600', glow: 'shadow-violet-200', Preview: WordlePreview },
  { title: 'Виселица', subtitle: 'Открывай буквы и сохраняй жизни', tone: 'from-sky-500 to-blue-600', glow: 'shadow-blue-200', Preview: HangmanPreview },
  { title: 'Анаграммы', subtitle: 'Составляй слова из букв', tone: 'from-amber-400 to-orange-500', glow: 'shadow-orange-200', Preview: AnagramPreview },
  { title: 'Спринт', subtitle: 'Отвечай быстро и зарабатывай очки', tone: 'from-emerald-400 to-green-600', glow: 'shadow-emerald-200', Preview: SprintPreview },
  { title: 'Змейка', subtitle: 'Собирай слова и расти!', tone: 'from-rose-400 to-pink-500', glow: 'shadow-rose-200', Preview: SnakePreview },
];

const HeroScene = () => (
  <div className="relative mx-auto aspect-[16/11] w-full max-w-[44rem] overflow-hidden rounded-[1.7rem] border border-white/80 bg-violet-50 shadow-xl shadow-indigo-900/10 sm:aspect-[4/3] sm:rounded-[2rem]">
    <img src={asset('hero-scene.webp')} alt="Питомец AnnWord в сказочном игровом мире" className="absolute inset-0 h-full w-full object-cover object-[52%_center] sm:object-center" fetchPriority="high" decoding="async" draggable={false} />
    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-indigo-950/5" aria-hidden="true" />
    <div className="absolute inset-x-3 bottom-3 z-20 flex items-center rounded-2xl border border-white/80 bg-white/94 px-3 py-2.5 shadow-xl backdrop-blur-sm sm:hidden">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black text-indigo-950"><span>Дневная цель</span><span>10/15</span></div>
        <div className="mt-1.5 h-1.5 rounded-full bg-blue-100"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 to-blue-600" /></div>
      </div>
      <div className="ml-3 whitespace-nowrap rounded-xl bg-orange-50 px-2 py-1.5 text-[10px] font-black text-orange-700">🔥 3 дня</div>
    </div>
    <div className="absolute right-5 top-5 z-20 hidden w-[12.5rem] rotate-1 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-sm sm:block">
      <div className="flex items-center justify-between gap-2 text-[11px] font-black text-indigo-950"><span>Дневная цель</span><span className="whitespace-nowrap">🔥 3 дня</span></div>
      <div className="mt-2 text-xs font-black text-slate-600">Выучить 15 новых слов</div>
      <div className="mt-2 h-2 rounded-full bg-blue-100"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 to-blue-600" /></div>
      <div className="mt-1 text-right text-[10px] font-black text-indigo-900">10/15</div>
    </div>
    <div className="absolute bottom-3 right-3 z-20 hidden w-[11.5rem] -rotate-1 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-sm sm:block sm:right-5 sm:w-[13rem]">
      <div className="text-[11px] font-black text-indigo-950">Сегодня ты молодец!</div>
      <div className="mt-1 text-lg tracking-wider text-amber-400">★★★★★</div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2"><span className="text-[9px] font-black text-slate-500">Награда</span><span className="text-sm font-black text-violet-700">+50 🪙</span></div>
    </div>
  </div>
);

const ProblemVisual: React.FC<{ index: number }> = ({ index }) => (
  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-violet-50 via-white to-sky-50 sm:h-48">
    <img src={asset(`problem-${index + 1}.webp`)} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
  </div>
);

const StepVisual: React.FC<{ index: number }> = ({ index }) => (
  <div className="relative h-48 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-violet-50 via-white to-blue-50 sm:h-52">
    <img src={asset(`step-${index + 1}.webp`)} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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

  const petStages = [
    [asset('pet-stage-1.webp'), 'Щенок'],
    [asset('pet-stage-2.webp'), 'Малыш'],
    [asset('pet-stage-3.webp'), 'Друг'],
    [asset('pet-stage-4.webp'), 'Герой'],
  ];

  const rewards = [
    [asset('reward-coins.webp'), 'Монетки +100'],
    [asset('reward-crystal.webp'), 'Кристаллы +5'],
    [asset('reward-cup.webp'), 'Кубок «Молодец!»'],
    [asset('reward-cap.webp'), 'Кепка чемпиона'],
    [asset('reward-glasses.webp'), 'Очки стиля'],
    [asset('reward-backpack.webp'), 'Рюкзак исследователя'],
  ];

  return (
    <ScreenContainer className="max-w-7xl pb-20 pt-3 sm:pt-5">
      <main className="-mx-4 overflow-hidden bg-white sm:mx-0">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_78%_8%,rgba(186,230,253,0.7),transparent_30%),radial-gradient(circle_at_13%_20%,rgba(237,233,254,0.95),transparent_28%),linear-gradient(135deg,#ffffff_0%,#faf9ff_48%,#eef8ff_100%)] px-4 pb-4 pt-4 sm:px-7 sm:pb-6 sm:pt-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div className="relative z-10 py-2">
              <h1 className="max-w-xl text-4xl font-black leading-[0.96] tracking-[-0.048em] text-indigo-950 sm:text-6xl lg:text-[4.55rem]">Снова задали <span className="text-violet-600">слова</span> к пятнице?</h1>
              <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-slate-600 sm:text-xl">AnnWord превращает школьные слова в короткие игры с прогрессом, наградами и радостью каждый день!</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={onStartKids} className="rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-8 py-4 text-lg font-black text-white shadow-xl shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:shadow-2xl">Начать бесплатно</button>
              </div>
            </div>
            <HeroScene />
          </div>
          <div className="relative z-20 mt-4 grid grid-cols-2 gap-2 rounded-[1.6rem] border border-white/80 bg-white/95 p-2 shadow-xl shadow-indigo-900/8 backdrop-blur sm:mt-5 sm:grid-cols-2 sm:rounded-[1.8rem] lg:grid-cols-4">{trustItems.map((item, index) => <article key={item.title} className="flex min-h-[4.1rem] items-center gap-2 rounded-[1.1rem] px-2 py-2 transition hover:bg-indigo-50/60 sm:min-h-[4.75rem] sm:gap-3 sm:rounded-[1.35rem] sm:px-3 sm:py-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-black sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl ${index === 1 ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}`} aria-hidden="true">{item.icon}</div><div><h2 className="text-[11px] font-black leading-tight text-indigo-950 sm:text-sm">{item.title}</h2>{item.text && <p className="mt-1 text-[11px] font-bold leading-snug text-slate-400">{item.text}</p>}</div></article>)}</div>
        </section>

        <section className="relative bg-gradient-to-b from-indigo-50/45 via-white to-white px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><h2 className="text-2xl font-black text-indigo-950 sm:text-4xl"><PawMark className="mr-2 text-violet-300" />Почему обычная зубрёжка не работает<PawMark className="ml-2 text-violet-300" /></h2></div>
          <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">{problemCards.map((item, index) => <article key={item.title} className="group min-w-[78vw] snap-center overflow-hidden rounded-[2rem] border border-indigo-50 bg-white shadow-lg shadow-indigo-900/6 transition hover:-translate-y-1 hover:shadow-xl sm:min-w-0"><ProblemVisual index={index}/><div className="p-5 text-center"><h3 className="text-lg font-black text-indigo-950">{item.title}</h3><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{item.text}</p></div></article>)}</div>
        </section>

        <section id="how-it-works" className="relative scroll-mt-24 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><h2 className="text-2xl font-black text-indigo-950 sm:text-4xl"><PawMark className="mr-2 text-violet-300" />Что делает AnnWord<PawMark className="ml-2 text-violet-300" /></h2></div>
          <div className="relative -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            <div className="pointer-events-none absolute left-[19%] right-[19%] top-16 hidden border-t-2 border-dashed border-violet-300 lg:block" aria-hidden="true" />
            {parentSteps.map((step, index) => <article key={step.title} className="relative z-10 min-w-[84vw] snap-center overflow-hidden rounded-[2rem] border border-indigo-50 bg-white p-4 shadow-lg shadow-indigo-900/6 sm:min-w-0"><div className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-lg">{index + 1}</div><StepVisual index={index}/><div className="px-2 pb-2 pt-4 text-center"><h3 className="text-xl font-black leading-tight text-indigo-950">{step.title}</h3><p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-relaxed text-slate-500">{step.text}</p>{index === 0 && <div className="mt-3 flex flex-wrap justify-center gap-1.5"><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-600">Список учителя</span><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-600">Скриншот</span><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-600">Вручную</span></div>}</div></article>)}
          </div>
        </section>

        <section id="game-modes" className="relative scroll-mt-24 border-y border-indigo-50 bg-[linear-gradient(180deg,#f7f5ff_0%,#ffffff_48%,#f5fbff_100%)] px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><h2 className="text-2xl font-black text-indigo-950 sm:text-4xl"><PawMark className="mr-2 text-violet-300" />Режимы игры<PawMark className="ml-2 text-violet-300" /></h2></div>
          <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">{gameCards.map(({ title, subtitle, tone, glow, Preview }) => <article key={title} className={`min-w-[78vw] snap-center overflow-hidden rounded-[1.45rem] border-2 border-white bg-white shadow-lg ${glow} transition hover:-translate-y-1 sm:min-w-0`}><div className={`bg-gradient-to-r ${tone} px-4 py-3 text-center text-base font-black text-white`}>{title}</div><div className="h-[16rem] p-2"><Preview /></div><div className="px-3 pb-4 text-center text-xs font-black leading-snug text-indigo-900">{subtitle}</div></article>)}</div>
        </section>

        <section className="px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="overflow-hidden rounded-[2.3rem] border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-sky-50 p-5 shadow-lg shadow-indigo-900/6 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-2xl font-black text-indigo-950 sm:text-3xl"><PawMark className="mr-2 text-violet-300" />Расти вместе с питомцем!</h2></div><div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-violet-700 shadow-sm">Получи следующую форму за серию дней · 🔥 3 дня подряд!</div></div>
            <div className="mt-5 grid grid-cols-4 gap-1.5 sm:mt-6 sm:gap-3">{petStages.map(([src, label], index) => <div key={label} className="relative overflow-hidden rounded-[1.2rem] bg-white p-1.5 text-center shadow-md shadow-indigo-900/5 sm:rounded-[1.8rem] sm:p-3"><div className="flex h-20 items-end justify-center overflow-hidden px-0.5 pb-0 pt-1 sm:h-40 sm:px-1 sm:pt-2"><img src={src} alt={label} loading="lazy" decoding="async" className={`h-full w-full origin-bottom object-contain object-bottom drop-shadow-lg transform-gpu ${index === 0 ? 'scale-[0.78]' : index === 1 ? 'scale-[0.88]' : index === 2 ? 'scale-[0.96]' : 'scale-[1.03]'}`} /></div><div className="mt-1.5 text-[11px] font-black text-indigo-950 sm:mt-3 sm:text-sm">{label}</div>{index < 3 && <span className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 text-3xl font-black text-violet-400 sm:block">→</span>}</div>)}</div>
          </div>
        </section>

        <section className="px-4 pb-8 sm:px-8 sm:pb-10 lg:px-10">
          <div className="overflow-hidden rounded-[2.35rem] bg-gradient-to-r from-indigo-700 via-violet-600 to-sky-500 p-5 text-white shadow-2xl shadow-indigo-700/20 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
              <div className="flex items-center gap-3 sm:grid sm:grid-cols-[11rem_1fr]"><img src={asset('cta-mascot.webp')} alt="Питомец AnnWord летит за наградами" loading="lazy" decoding="async" className="-ml-2 h-24 w-24 shrink-0 object-contain drop-shadow-2xl sm:-my-4 sm:-ml-3 sm:h-44 sm:w-44 sm:max-w-none" /><div><h2 className="text-xl font-black leading-tight sm:text-3xl">Играй и получай награды!</h2><p className="mt-1.5 text-xs font-bold leading-relaxed text-indigo-100 sm:mt-2 sm:text-sm">Монеты, кристаллы и вещи для питомца превращают усилия в видимый результат.</p></div></div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{rewards.map(([src, label]) => <div key={label} className="rounded-2xl bg-white/95 p-2 text-center text-indigo-950 shadow-lg"><img src={src} alt={label} loading="lazy" decoding="async" className="mx-auto h-14 w-14 object-contain sm:h-16 sm:w-16" /><div className="mt-1 text-[10px] font-black sm:text-xs">{label}</div></div>)}</div>
            </div>
          </div>
        </section>

        <section id="for-parents" className="scroll-mt-24 px-4 pb-8 sm:px-8 sm:pb-10 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[2.15rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6 shadow-lg sm:min-h-[20rem] sm:pr-[46%]"><h2 className="text-2xl font-black text-indigo-950">Польза для ребёнка</h2><ul className="mt-5 space-y-3">{childBenefits.map(item => <li key={item} className="flex gap-2 text-sm font-bold leading-relaxed text-slate-600"><span className="mt-0.5 font-black text-emerald-500">✓</span><span>{item}</span></li>)}</ul><img src={asset('benefit-child.webp')} alt="Ребёнок занимается с AnnWord" loading="lazy" decoding="async" className="mt-5 h-44 w-full rounded-[1.6rem] object-cover object-center shadow-lg sm:absolute sm:bottom-4 sm:right-4 sm:mt-0 sm:h-[calc(100%-2rem)] sm:w-[42%]" /></article>
            <article className="relative overflow-hidden rounded-[2.15rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 shadow-lg sm:min-h-[20rem] sm:pr-[46%]"><h2 className="text-2xl font-black text-indigo-950">Польза для родителей</h2><ul className="mt-5 space-y-3">{parentBenefits.map(item => <li key={item} className="flex gap-2 text-sm font-bold leading-relaxed text-slate-600"><span className="mt-0.5 font-black text-blue-500">✓</span><span>{item}</span></li>)}</ul><img src={asset('benefit-parent.webp')} alt="Родитель видит прогресс ребёнка" loading="lazy" decoding="async" className="mt-5 w-full rounded-[1.6rem] object-cover shadow-lg sm:absolute sm:bottom-4 sm:right-4 sm:mt-0 sm:h-[calc(100%-2rem)] sm:w-[42%]" /></article>
          </div>
        </section>

        <section className="px-4 pb-5 sm:px-8 sm:pb-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[2.3rem] bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-600 px-5 py-7 text-white shadow-2xl shadow-indigo-700/20 sm:px-8 sm:py-8">
            <div className="absolute -bottom-14 -right-8 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute right-14 top-5 text-5xl opacity-80" aria-hidden="true">✈</div>
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4"><img src={asset('cta-mascot.webp')} alt="Радостный питомец AnnWord" loading="lazy" decoding="async" className="hidden h-32 w-32 object-contain drop-shadow-2xl sm:block" /><div><h2 className="text-2xl font-black leading-tight sm:text-3xl">Начните учить слова в игре уже сегодня!</h2><p className="mt-2 text-sm font-bold text-indigo-100">Без рекламы. С прогрессом, который видно.</p></div></div>
              <button type="button" onClick={onStartKids} className="shrink-0 rounded-2xl bg-amber-300 px-7 py-4 text-lg font-black text-indigo-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-amber-200">Начать бесплатно</button>
            </div>
          </div>
        </section>
        <div className="pb-5 text-center text-xs font-black text-indigo-700 sm:pb-7"><PawMark className="mr-2 text-violet-300" />Безопасно и без рекламы — для вашего спокойствия<PawMark className="ml-2 text-violet-300" /></div>
      </main>
    </ScreenContainer>
  );
};
