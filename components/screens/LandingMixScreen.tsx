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

const PET_IDLE = '/assets/pets/puppy/base/idle.png';
const PET_BOW = '/assets/pets/puppy/with-accessories/bow.png';
const PET_HAT = '/assets/pets/puppy/with-accessories/bow_hat.png';
const PET_HERO = '/assets/pets/puppy/with-accessories/bow_hero_cape.png';
const PET_SCENE = '/assets/pets/puppy/background.webp';

const problemCards = [
  { title: 'Скучно и утомительно', text: 'Монотонные списки быстро утомляют и отбивают интерес.' },
  { title: 'Слова забываются', text: 'Без регулярной практики новые слова быстро выпадают из памяти.' },
  { title: 'Оценки давят', text: 'Страх ошибок мешает спокойно пробовать, вспоминать и закреплять слова.' },
  { title: 'Родителям сложно', text: 'Непонятно, что уже выучено, где ребёнку нужна помощь и есть ли результат.' },
];

const parentSteps = [
  { title: 'Вы добавляете слова', text: 'Загрузите список преподавателя или добавьте слова вручную вместе с переводом.' },
  { title: 'Ребёнок играет и учит', text: 'Короткие игровые сессии помогают вспоминать слова снова и снова без зубрёжки.' },
  { title: 'Вы видите прогресс', text: 'В кабинете видно динамику, серию занятий и слова, которые требуют повторения.' },
];

const teacherBenefits = [
  { icon: '🔗', title: 'Подключение по коду', text: 'Родитель создаёт код ребёнка, а преподаватель подключает ученика в своём кабинете.' },
  { icon: '📚', title: 'Свои подборки слов', text: 'Назначайте ученику лексику к следующему уроку без карточек и переписки.' },
  { icon: '📊', title: 'Прогресс по словам', text: 'Видно, какие слова уже закрепились, а где ребёнку нужна дополнительная практика.' },
];

const trustItems = [
  { icon: '⏱', title: 'Короткие игровые сессии', text: 'Легко встроить в день' },
  { icon: '⊘', title: 'Без рекламы — гарантировано', text: 'Никаких баннеров и рекламных вставок' },
  { icon: '◆', title: 'Безопасная среда', text: 'Без лишнего отвлекающего контента' },
  { icon: '↗', title: 'Понятный прогресс', text: 'Родитель видит результат' },
];

const childBenefits = [
  'Учёба проходит через игру, а не через длинные списки',
  'Разные механики помогают не уставать от повторения',
  'За успехи появляются монеты, подарки и аксессуары',
  'Ребёнок видит свой прогресс и хочет продолжать',
];

const parentBenefits = [
  'Видите реальный прогресс и статистику занятий',
  'Понимаете, какие слова вызывают трудности',
  'Экономите время на проверках и дополнительных заданиях',
  'Спокойны: в приложении гарантированно нет рекламы',
];

const WordlePreview = () => {
  const rows = [
    [['A', 'bg-slate-400 text-white'], ['P', 'bg-amber-400 text-white'], ['P', 'bg-amber-400 text-white'], ['L', 'bg-slate-400 text-white'], ['E', 'bg-slate-400 text-white']],
    [['P', 'bg-slate-400 text-white'], ['L', 'bg-emerald-500 text-white'], ['A', 'bg-amber-400 text-white'], ['N', 'bg-slate-400 text-white'], ['E', 'bg-emerald-500 text-white']],
    [['A', 'bg-emerald-500 text-white'], ['P', 'bg-emerald-500 text-white'], ['P', 'bg-emerald-500 text-white'], ['L', 'bg-emerald-500 text-white'], ['E', 'bg-emerald-500 text-white']],
  ];
  return <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-violet-50 via-white to-violet-50 p-3 shadow-inner">
    <div className="grid grid-cols-5 gap-1.5">{rows.flatMap((row, rowIndex) => row.map(([letter, tone], colIndex) => <div key={`${rowIndex}-${colIndex}`} className={`flex aspect-square items-center justify-center rounded-lg text-sm font-black shadow-sm ${tone}`}>{letter}</div>))}</div>
    <div className="mt-3 space-y-1">{['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map(row => <div key={row} className="flex justify-center gap-0.5">{row.split('').map(letter => <span key={letter} className={`flex h-5 min-w-4 items-center justify-center rounded text-[7px] font-black ${'APPLE'.includes(letter) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'}`}>{letter}</span>)}</div>)}</div>
  </div>;
};

const HangmanPreview = () => {
  const guessed = new Set(['S', 'C', 'O', 'L']);
  return <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-blue-50 via-white to-blue-50 p-3 shadow-inner">
    <div className="flex justify-center gap-0.5 text-base" aria-label="Осталось семь попыток">{Array.from({ length: 7 }).map((_, index) => <span key={index}>❤️</span>)}</div>
    <div className="mt-3 flex justify-center gap-1.5">{'SCHOOL'.split('').map((letter, index) => <div key={`${letter}-${index}`} className="flex h-8 w-6 items-center justify-center border-b-2 border-indigo-500 text-sm font-black text-indigo-950">{guessed.has(letter) ? letter : ''}</div>)}</div>
    <div className="mt-3 grid grid-cols-7 gap-1">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <span key={letter} className={`flex h-5 items-center justify-center rounded text-[7px] font-black ${guessed.has(letter) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'}`}>{letter}</span>)}</div>
  </div>;
};

const AnagramPreview = () => <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-orange-50 via-white to-amber-50 p-3 text-center shadow-inner">
  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Перевод</div>
  <div className="mt-0.5 text-lg font-black text-indigo-950">тигр</div>
  <div className="mt-3 grid grid-cols-5 gap-1.5 rounded-xl border-2 border-dashed border-orange-100 bg-white/80 p-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="aspect-square rounded-md bg-orange-50 shadow-inner" />)}</div>
  <div className="mt-3 grid grid-cols-5 gap-1.5">{'GITER'.split('').map((letter, index) => <div key={`${letter}-${index}`} className="flex aspect-square items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white shadow-md">{letter}</div>)}</div>
  <div className="mt-auto pt-2 text-[9px] font-black text-rose-500">Не знаю</div>
</div>;

const SprintPreview = () => <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-emerald-50 via-white to-green-50 p-3 shadow-inner">
  <div className="flex justify-end"><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-600 shadow-sm">⏱ 42с</span></div>
  <div className="mt-2 text-center"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Как будет по-английски?</div><div className="mt-1 text-xl font-black text-indigo-950">книга</div></div>
  <div className="mt-3 space-y-1.5">{['book', 'pencil', 'school', 'window'].map((option, index) => <div key={option} className={`rounded-xl border px-3 py-2 text-center text-xs font-black shadow-sm ${index === 0 ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-100 bg-white text-slate-600'}`}>{option}</div>)}</div>
</div>;

const SnakePreview = () => {
  const cells = ['M','A','P','L','E','T','B','O','O','K','S','H','I','P','D','F','R','I','E','N','C','A','T','S','Y'];
  const selected = new Map([[6, 1], [7, 2], [8, 3], [9, 4]]);
  return <div className="flex h-full flex-col rounded-[1.35rem] bg-gradient-to-b from-rose-50 via-white to-pink-50 p-3 shadow-inner">
    <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm"><div className="text-sm font-black text-indigo-950">книга</div><div className="mt-0.5 text-[8px] font-bold text-slate-400">4 буквы · соседние клетки</div></div>
    <div className="mt-3 grid grid-cols-5 gap-1.5">{cells.map((letter, index) => { const order = selected.get(index); return <div key={`${letter}-${index}`} className={`relative flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-black shadow-sm ${order ? 'border-blue-500 bg-blue-100 text-blue-950' : 'border-amber-100 bg-white text-slate-700'}`}>{letter}{order && <span className="absolute left-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white">{order}</span>}</div>; })}</div>
    <div className="mt-2 text-center text-[8px] font-bold leading-tight text-indigo-500">Соберите слово из соседних клеток. Диагонали нельзя.</div>
  </div>;
};

const gameCards = [
  { title: 'Вордл', subtitle: 'Угадайте слово за 6 попыток', tone: 'from-violet-500 to-purple-600', glow: 'shadow-violet-200', Preview: WordlePreview },
  { title: 'Виселица', subtitle: 'Открывайте буквы, сохраняя сердечки', tone: 'from-sky-500 to-blue-600', glow: 'shadow-blue-200', Preview: HangmanPreview },
  { title: 'Анаграммы', subtitle: 'Соберите английское слово по переводу', tone: 'from-amber-400 to-orange-500', glow: 'shadow-orange-200', Preview: AnagramPreview },
  { title: 'Спринт', subtitle: 'Найдите английское слово на скорость', tone: 'from-emerald-400 to-green-600', glow: 'shadow-emerald-200', Preview: SprintPreview },
  { title: 'Змейка', subtitle: 'Соберите слово по соседним клеткам', tone: 'from-rose-400 to-pink-500', glow: 'shadow-rose-200', Preview: SnakePreview },
];

const HeroScene = () => <div className="relative mx-auto min-h-[24rem] w-full max-w-[44rem] overflow-hidden rounded-[2.4rem] border-4 border-white/80 shadow-2xl shadow-indigo-900/15 sm:min-h-[29rem]">
  <img src={PET_SCENE} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/20 via-transparent to-sky-100/30" />
  <div className="absolute -left-7 top-24 h-20 w-20 rounded-full bg-amber-300/90 blur-[1px]" aria-hidden="true" />
  <div className="absolute left-4 top-28 flex h-16 w-16 items-center justify-center rounded-full border-4 border-amber-100 bg-amber-300 text-2xl font-black text-amber-800 shadow-xl" aria-hidden="true">A</div>
  <img src={PET_HERO} alt="Радостный питомец AnnWord" className="absolute bottom-[-5%] left-[13%] z-10 w-[58%] max-w-[25rem] object-contain drop-shadow-2xl" fetchPriority="high" decoding="async" draggable={false} />
  <div className="absolute right-4 top-5 z-20 w-[12rem] rotate-1 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl sm:right-5 sm:w-[13rem]">
    <div className="flex items-center justify-between text-[11px] font-black text-indigo-950"><span>Дневная цель</span><span>🔥 3 дня подряд!</span></div>
    <div className="mt-3 text-xs font-black text-slate-600">Выучить 15 новых слов</div>
    <div className="mt-2 h-2 rounded-full bg-blue-100"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 to-blue-600" /></div>
    <div className="mt-1 text-right text-[10px] font-black text-indigo-900">10/15</div>
  </div>
  <div className="absolute bottom-5 right-4 z-20 w-[12.5rem] -rotate-1 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl sm:right-6 sm:w-[14rem]">
    <div className="text-[11px] font-black text-indigo-950">Сегодня ты молодец!</div>
    <div className="mt-2 text-xl tracking-wider text-amber-400">★★★★★</div>
    <div className="mt-3 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2"><span className="text-[10px] font-black text-slate-500">Награда</span><span className="text-base font-black text-violet-700">+50 🪙</span></div>
  </div>
  <div className="absolute left-[48%] top-10 z-20 text-3xl drop-shadow-lg" aria-hidden="true">✨</div>
  <div className="absolute bottom-12 left-5 z-20 flex h-14 w-14 rotate-[-10deg] items-center justify-center rounded-2xl bg-violet-600 text-2xl text-white shadow-xl" aria-hidden="true">🐾</div>
</div>;

const ProblemVisual: React.FC<{ index: number }> = ({ index }) => {
  if (index === 0) return <div className="relative flex h-40 items-end justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50"><img src="/assets/kids-mascot.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-[145%] max-w-none translate-y-[36%] object-contain" /><div className="absolute right-5 top-5 rounded-full bg-white p-3 text-2xl shadow-md">🌀</div></div>;
  if (index === 1) return <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 to-indigo-50"><div className="absolute -left-4 top-6 h-24 w-20 rotate-[-9deg] rounded-2xl border border-blue-100 bg-white shadow-lg"/><img src="/assets/games/game_anagrams.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="relative z-10 h-28 w-28 object-contain drop-shadow-xl"/><div className="absolute bottom-4 right-5 rounded-xl bg-white px-4 py-2 text-sm font-black text-indigo-900 shadow-lg">🍎 apple</div></div>;
  if (index === 2) return <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50"><div className="text-[5.5rem] drop-shadow-lg grayscale">🏆</div><span className="absolute left-[28%] top-[54%] flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-xl font-black text-white shadow-lg">×</span><span className="absolute right-[28%] top-[54%] flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-xl font-black text-white shadow-lg">×</span></div>;
  return <div className="relative flex h-40 items-end justify-center overflow-hidden bg-gradient-to-br from-rose-50 to-violet-50"><img src="/assets/onboarding/account-mode-parent.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="mb-4 h-28 w-28 object-contain drop-shadow-xl"/><div className="absolute right-5 top-6 rounded-2xl bg-white p-3 shadow-lg"><div className="flex h-10 items-end gap-1"><span className="h-4 w-2 rounded bg-blue-300"/><span className="h-7 w-2 rounded bg-violet-400"/><span className="h-10 w-2 rounded bg-emerald-400"/></div></div></div>;
};

const StepVisual: React.FC<{ index: number }> = ({ index }) => {
  const sources = ['/assets/onboarding/account-mode-parent.webp', '/assets/kids-mascot.webp', '/assets/onboarding/account-mode-parent.webp'];
  return <div className="relative flex h-40 items-end justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-violet-50 via-white to-blue-50">
    <img src={sources[index]} alt="" aria-hidden="true" loading="lazy" decoding="async" className={`${index === 1 ? 'h-[155%] translate-y-[38%]' : 'mb-3 h-32'} max-w-[11rem] object-contain drop-shadow-xl`} />
    {index === 0 && <div className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-2xl font-black text-white shadow-lg">+</div>}
    {index === 2 && <div className="absolute bottom-5 right-5 rounded-2xl bg-white p-3 shadow-lg"><div className="flex h-9 items-end gap-1"><span className="h-4 w-2 rounded bg-blue-300"/><span className="h-7 w-2 rounded bg-violet-400"/><span className="h-9 w-2 rounded bg-emerald-400"/></div></div>}
  </div>;
};

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
      <main className="overflow-hidden rounded-[1.75rem] border border-indigo-50 bg-white shadow-xl shadow-indigo-950/5 sm:rounded-[2.5rem]">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_78%_8%,rgba(186,230,253,0.65),transparent_28%),radial-gradient(circle_at_13%_20%,rgba(237,233,254,0.9),transparent_25%),linear-gradient(135deg,#ffffff_0%,#faf9ff_48%,#eef8ff_100%)] px-4 pb-5 pt-6 sm:px-8 sm:pb-8 sm:pt-9 lg:px-10">
          <div className="absolute left-[43%] top-6 h-16 w-16 rounded-full bg-amber-200/50 blur-2xl" aria-hidden="true"/>
          <div className="grid gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div className="relative z-10 py-2">
              <h1 className="max-w-xl text-4xl font-black leading-[0.96] tracking-[-0.048em] text-indigo-950 sm:text-6xl lg:text-[4.55rem]">Снова задали <span className="text-violet-600">слова</span> к пятнице?</h1>
              <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-slate-600 sm:text-xl">AnnWord превращает слова из школьного задания в короткие игры с прогрессом, наградами и радостью от каждого нового успеха.</p>
              <button type="button" onClick={onStartKids} className="mt-7 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-8 py-4 text-lg font-black text-white shadow-xl shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:shadow-2xl">Начать бесплатно</button>
            </div>
            <HeroScene />
          </div>
          <div className="relative z-20 mt-7 grid gap-1 rounded-[1.8rem] border border-white/80 bg-white/95 p-2 shadow-xl shadow-indigo-900/8 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">{trustItems.map((item, index) => <article key={item.title} className="flex min-h-[5.75rem] items-center gap-3 rounded-[1.35rem] px-3 py-3 transition hover:bg-indigo-50/60"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${index === 1 ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}`} aria-hidden="true">{item.icon}</div><div><h2 className="text-sm font-black leading-tight text-indigo-950">{item.title}</h2><p className="mt-1 text-[11px] font-bold leading-snug text-slate-400">{item.text}</p></div></article>)}</div>
        </section>

        <section className="relative bg-gradient-to-b from-indigo-50/45 via-white to-white px-4 py-9 sm:px-8 sm:py-12 lg:px-10">
          <div className="absolute left-6 top-8 text-2xl text-violet-300" aria-hidden="true">🐾</div><div className="absolute right-6 top-8 text-2xl text-violet-300" aria-hidden="true">🐾</div>
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Знакомо?</div><h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-4xl">Почему обычная зубрёжка не работает</h2></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{problemCards.map((item, index) => <article key={item.title} className="group overflow-hidden rounded-[2rem] border border-indigo-50 bg-white shadow-lg shadow-indigo-900/6 transition hover:-translate-y-1 hover:shadow-xl"><ProblemVisual index={index}/><div className="p-5 text-center"><h3 className="text-lg font-black text-indigo-950">{item.title}</h3><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{item.text}</p></div></article>)}</div>
        </section>

        <section className="relative px-4 py-9 sm:px-8 sm:py-12 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Три шага</div><h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-4xl">Как это работает?</h2><p className="mt-2 text-sm font-bold text-slate-500 sm:text-base">От списка слов до понятного результата — без лишней рутины.</p></div>
          <div className="relative mt-8 grid gap-4 lg:grid-cols-3">
            <div className="pointer-events-none absolute left-[19%] right-[19%] top-12 hidden border-t-2 border-dashed border-violet-300 lg:block" aria-hidden="true"/>
            {parentSteps.map((step, index) => <article key={step.title} className="relative z-10 overflow-hidden rounded-[2rem] border border-indigo-50 bg-white p-4 shadow-lg shadow-indigo-900/6"><div className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-lg">{index + 1}</div><StepVisual index={index}/><div className="px-2 pb-2 pt-4 text-center"><h3 className="text-xl font-black leading-tight text-indigo-950">{step.title}</h3><p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-relaxed text-slate-500">{step.text}</p>{index === 0 && <div className="mt-3 flex flex-wrap justify-center gap-1.5"><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-600">Список учителя</span><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-600">Скриншот</span><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-600">Вручную</span></div>}</div></article>)}
          </div>
        </section>

        <section className="relative border-y border-indigo-50 bg-[linear-gradient(180deg,#f7f5ff_0%,#ffffff_48%,#f5fbff_100%)] px-4 py-9 sm:px-8 sm:py-12 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Реальный интерфейс</div><h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-4xl">Режимы игры</h2><p className="mt-2 text-sm font-bold text-slate-500 sm:text-base">Пять разных механик на одних и тех же словах — чтобы повторение не превращалось в рутину.</p></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{gameCards.map(({ title, subtitle, tone, glow, Preview }) => <article key={title} className={`overflow-hidden rounded-[1.8rem] border-2 border-white bg-white shadow-xl ${glow} transition hover:-translate-y-1`}><div className={`bg-gradient-to-r ${tone} px-4 py-3 text-center text-base font-black text-white`}>{title}</div><div className="h-[18.5rem] p-2"><Preview /></div><div className="px-3 pb-4 text-center text-xs font-black leading-snug text-indigo-900">{subtitle}</div></article>)}</div>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-center text-xs font-bold leading-relaxed text-blue-700">В «Виселице» ошибки снимают сердечки — без изображения повешения. В «Змейке» слово собирается только по соседним клеткам.</div>
        </section>

        <section className="px-4 py-9 sm:px-8 sm:py-12 lg:px-10">
          <div className="overflow-hidden rounded-[2.2rem] border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-sky-50 p-5 shadow-lg shadow-indigo-900/6 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-xs font-black uppercase tracking-[0.22em] text-violet-400">Питомец рядом с успехами</div><h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-3xl">Стараемся, выигрываем, меняем образ</h2></div><div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-violet-700 shadow-sm">🔥 3 дня подряд · следующая награда близко</div></div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
              [PET_IDLE, 'Знакомимся'], [PET_BOW, 'Учимся'], [PET_HAT, 'Стараемся'], [PET_HERO, 'Побеждаем!'],
            ].map(([src, label], index) => <div key={label} className="relative rounded-[1.7rem] bg-white p-3 text-center shadow-md shadow-indigo-900/5"><img src={src} alt={label} loading="lazy" decoding="async" className="mx-auto h-28 w-full object-contain drop-shadow-lg sm:h-32"/><div className="mt-2 text-sm font-black text-indigo-950">{label}</div>{index < 3 && <span className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 text-3xl font-black text-violet-400 sm:block">→</span>}</div>)}</div>
          </div>
        </section>

        <section className="px-4 pb-9 sm:px-8 sm:pb-12 lg:px-10">
          <div className="overflow-hidden rounded-[2.25rem] bg-gradient-to-r from-indigo-700 via-violet-600 to-sky-500 p-5 text-white shadow-2xl shadow-indigo-700/20 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr] lg:items-center">
              <div className="grid grid-cols-[8rem_1fr] items-center gap-3"><img src={PET_HERO} alt="Питомец AnnWord в плаще" loading="lazy" decoding="async" className="w-full object-contain drop-shadow-2xl" draggable={false}/><div><h2 className="text-2xl font-black leading-tight sm:text-3xl">Мотивация, которая вдохновляет</h2><p className="mt-2 text-sm font-bold leading-relaxed text-indigo-100">Монеты, подарки и аксессуары делают прогресс заметным, а возвращение к словам — желанным.</p></div></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950 shadow-lg"><img src="/assets/rewards/mystery-box.webp" alt="Секретная коробка" loading="lazy" decoding="async" className="mx-auto h-20 w-20 object-contain"/><div className="mt-2 text-xs font-black">Подарки</div></div><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950 shadow-lg"><img src={PET_HAT} alt="Шляпа для питомца" loading="lazy" decoding="async" className="mx-auto h-20 w-20 object-contain"/><div className="mt-2 text-xs font-black">Аксессуары</div></div><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950 shadow-lg"><img src="/assets/pets/puppy/with-accessories/bow_glasses.png" alt="Очки для питомца" loading="lazy" decoding="async" className="mx-auto h-20 w-20 object-contain"/><div className="mt-2 text-xs font-black">Новые образы</div></div><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950 shadow-lg"><img src={PET_IDLE} alt="Питомец AnnWord" loading="lazy" decoding="async" className="mx-auto h-20 w-20 object-contain"/><div className="mt-2 text-xs font-black">Питомец</div></div></div>
            </div>
            <div className="mt-5 grid gap-2 rounded-[1.7rem] bg-white/95 p-3 text-indigo-950 sm:grid-cols-3"><div className="rounded-2xl bg-indigo-50 p-4"><div className="text-sm font-black">Без рекламы — гарантировано</div><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Никаких рекламных баннеров, роликов и сторонних вставок.</p></div><div className="rounded-2xl bg-indigo-50 p-4"><div className="text-sm font-black">Меньше уговоров</div><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Игры, питомец и награды дают ребёнку понятную причину вернуться.</p></div><div className="rounded-2xl bg-indigo-50 p-4"><div className="text-sm font-black">Результат перед глазами</div><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Родитель видит прогресс и понимает, где ещё нужна практика.</p></div></div>
          </div>
        </section>

        <section className="px-4 pb-9 sm:px-8 sm:pb-12 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6 shadow-lg sm:min-h-[20rem] sm:pr-52"><h2 className="text-2xl font-black text-indigo-950">Польза для ребёнка</h2><ul className="mt-5 space-y-3">{childBenefits.map(item => <li key={item} className="flex gap-2 text-sm font-bold leading-relaxed text-slate-600"><span className="mt-0.5 font-black text-emerald-500">✓</span><span>{item}</span></li>)}</ul><img src="/assets/kids-mascot.webp" alt="Ребёнок занимается с AnnWord" loading="lazy" decoding="async" className="mt-4 w-40 object-contain sm:absolute sm:bottom-[-3rem] sm:right-2 sm:mt-0 sm:w-52"/></article>
            <article className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 shadow-lg sm:min-h-[20rem] sm:pr-52"><h2 className="text-2xl font-black text-indigo-950">Польза для родителей</h2><ul className="mt-5 space-y-3">{parentBenefits.map(item => <li key={item} className="flex gap-2 text-sm font-bold leading-relaxed text-slate-600"><span className="mt-0.5 font-black text-blue-500">✓</span><span>{item}</span></li>)}</ul><img src="/assets/onboarding/account-mode-parent.webp" alt="Родитель видит прогресс ребёнка" loading="lazy" decoding="async" className="mt-4 w-36 object-contain sm:absolute sm:bottom-4 sm:right-7 sm:mt-0 sm:w-40"/></article>
          </div>
        </section>

        <section className="px-4 pb-5 sm:px-8 sm:pb-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[2.15rem] bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-600 px-5 py-7 text-white shadow-2xl shadow-indigo-700/20 sm:px-8 sm:py-8"><div className="absolute -bottom-14 -right-8 h-48 w-48 rounded-full bg-white/10" aria-hidden="true"/><div className="absolute right-14 top-5 text-5xl opacity-80" aria-hidden="true">✈</div><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><img src={PET_HERO} alt="Радостный питомец AnnWord" loading="lazy" decoding="async" className="hidden h-28 w-28 object-contain drop-shadow-xl sm:block"/><div><h2 className="text-2xl font-black leading-tight sm:text-3xl">Начните учить слова в игре уже сегодня!</h2><p className="mt-2 text-sm font-bold text-indigo-100">Без рекламы. Без лишних отвлечений. С прогрессом, который видно.</p></div></div><button type="button" onClick={onStartKids} className="shrink-0 rounded-2xl bg-amber-300 px-7 py-4 text-lg font-black text-indigo-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-amber-200">Начать бесплатно</button></div></div>
        </section>
      </main>
    </ScreenContainer>
  );
};
