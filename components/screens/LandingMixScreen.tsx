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

const HERO_IMAGE = '/assets/landing/reference-hero.webp';
const PROBLEM_SPRITE = '/assets/landing/reference-problems.webp';
const STEP_SPRITE = '/assets/landing/reference-steps.webp';

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
  'За успехи растёт питомец и появляются награды',
  'Ребёнок видит свой прогресс и хочет продолжать',
];

const parentBenefits = [
  'Видите реальный прогресс и статистику занятий',
  'Понимаете, какие слова вызывают трудности',
  'Экономите время на проверках и дополнительных заданиях',
  'Спокойны: в приложении гарантированно нет рекламы',
];

const SpriteArt: React.FC<{ sprite: string; index: number; count: number; className?: string; label?: string }> = ({ sprite, index, count, className = '', label = '' }) => {
  const position = count <= 1 ? 0 : (index / (count - 1)) * 100;
  return <div role="img" aria-label={label} className={`bg-no-repeat ${className}`} style={{ backgroundImage: `url(${sprite})`, backgroundSize: `${count * 100}% 100%`, backgroundPosition: `${position}% center` }} />;
};

const WordlePreview = () => {
  const rows = [
    [
      ['A', 'bg-slate-400 text-white'], ['P', 'bg-amber-400 text-white'], ['P', 'bg-amber-400 text-white'], ['L', 'bg-slate-400 text-white'], ['E', 'bg-slate-400 text-white'],
    ],
    [
      ['P', 'bg-slate-400 text-white'], ['L', 'bg-emerald-500 text-white'], ['A', 'bg-amber-400 text-white'], ['N', 'bg-slate-400 text-white'], ['E', 'bg-emerald-500 text-white'],
    ],
    [
      ['A', 'bg-emerald-500 text-white'], ['P', 'bg-emerald-500 text-white'], ['P', 'bg-emerald-500 text-white'], ['L', 'bg-emerald-500 text-white'], ['E', 'bg-emerald-500 text-white'],
    ],
  ];
  return <div className="flex h-full flex-col rounded-[1.4rem] bg-gradient-to-b from-violet-50 to-white p-3">
    <div className="grid grid-cols-5 gap-1.5">{rows.flatMap((row, rowIndex) => row.map(([letter, tone], colIndex) => <div key={`${rowIndex}-${colIndex}`} className={`flex aspect-square items-center justify-center rounded-lg text-sm font-black shadow-sm ${tone}`}>{letter}</div>))}</div>
    <div className="mt-3 space-y-1">{['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map(row => <div key={row} className="flex justify-center gap-0.5">{row.split('').map(letter => <span key={letter} className={`flex h-5 min-w-4 items-center justify-center rounded text-[7px] font-black ${'APPLE'.includes(letter) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'}`}>{letter}</span>)}</div>)}</div>
  </div>;
};

const HangmanPreview = () => {
  const guessed = new Set(['S', 'C', 'O', 'L']);
  return <div className="flex h-full flex-col rounded-[1.4rem] bg-gradient-to-b from-blue-50 to-white p-3">
    <div className="flex justify-center gap-0.5 text-base" aria-label="Осталось семь попыток">{Array.from({ length: 7 }).map((_, index) => <span key={index}>❤️</span>)}</div>
    <div className="mt-3 flex justify-center gap-1.5">{'SCHOOL'.split('').map((letter, index) => <div key={`${letter}-${index}`} className="flex h-8 w-6 items-center justify-center border-b-2 border-indigo-500 text-sm font-black text-indigo-950">{guessed.has(letter) ? letter : ''}</div>)}</div>
    <div className="mt-3 grid grid-cols-7 gap-1">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <span key={letter} className={`flex h-5 items-center justify-center rounded text-[7px] font-black ${guessed.has(letter) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'}`}>{letter}</span>)}</div>
  </div>;
};

const AnagramPreview = () => <div className="flex h-full flex-col rounded-[1.4rem] bg-gradient-to-b from-orange-50 to-white p-3 text-center">
  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Перевод</div>
  <div className="mt-0.5 text-lg font-black text-indigo-950">тигр</div>
  <div className="mt-3 grid grid-cols-5 gap-1.5 rounded-xl border-2 border-dashed border-indigo-100 bg-indigo-50 p-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="aspect-square rounded-md bg-white shadow-sm" />)}</div>
  <div className="mt-3 grid grid-cols-5 gap-1.5">{'GITER'.split('').map((letter, index) => <div key={`${letter}-${index}`} className="flex aspect-square items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white shadow-md">{letter}</div>)}</div>
  <div className="mt-auto pt-2 text-[9px] font-black text-rose-500">Не знаю</div>
</div>;

const SprintPreview = () => <div className="flex h-full flex-col rounded-[1.4rem] bg-gradient-to-b from-emerald-50 to-white p-3">
  <div className="flex justify-end"><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-600 shadow-sm">⏱ 42с</span></div>
  <div className="mt-2 text-center"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Как будет по-английски?</div><div className="mt-1 text-xl font-black text-indigo-950">книга</div></div>
  <div className="mt-3 space-y-1.5">{['book', 'pencil', 'school', 'window'].map((option, index) => <div key={option} className={`rounded-xl border px-3 py-2 text-center text-xs font-black shadow-sm ${index === 0 ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-100 bg-white text-slate-600'}`}>{option}</div>)}</div>
</div>;

const SnakePreview = () => {
  const cells = ['M','A','P','L','E','T','B','O','O','K','S','H','I','P','D','F','R','I','E','N','C','A','T','S','Y'];
  const selected = new Map([[6, 1], [7, 2], [8, 3], [9, 4]]);
  return <div className="flex h-full flex-col rounded-[1.4rem] bg-gradient-to-b from-rose-50 to-white p-3">
    <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm"><div className="text-sm font-black text-indigo-950">книга</div><div className="mt-0.5 text-[8px] font-bold text-slate-400">4 буквы · соседние клетки</div></div>
    <div className="mt-3 grid grid-cols-5 gap-1.5">{cells.map((letter, index) => { const order = selected.get(index); return <div key={`${letter}-${index}`} className={`relative flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-black shadow-sm ${order ? 'border-blue-500 bg-blue-100 text-blue-950' : 'border-amber-100 bg-white text-slate-700'}`}>{letter}{order && <span className="absolute left-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white">{order}</span>}</div>; })}</div>
    <div className="mt-2 text-center text-[8px] font-bold leading-tight text-indigo-500">Соберите слово из соседних клеток. Диагонали нельзя.</div>
  </div>;
};

const gameCards = [
  { title: 'Вордл', subtitle: 'Угадайте слово за 6 попыток', tone: 'from-violet-500 to-purple-600', Preview: WordlePreview },
  { title: 'Виселица', subtitle: 'Открывайте буквы, сохраняя сердечки', tone: 'from-sky-500 to-blue-600', Preview: HangmanPreview },
  { title: 'Анаграммы', subtitle: 'Соберите английское слово по переводу', tone: 'from-amber-400 to-orange-500', Preview: AnagramPreview },
  { title: 'Спринт', subtitle: 'Найдите английское слово на скорость', tone: 'from-emerald-400 to-green-600', Preview: SprintPreview },
  { title: 'Змейка', subtitle: 'Соберите слово по соседним клеткам', tone: 'from-rose-400 to-pink-500', Preview: SnakePreview },
];

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
      <main className="overflow-hidden rounded-[1.75rem] border border-indigo-50 bg-white shadow-sm sm:rounded-[2.25rem]">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_10%,rgba(191,219,254,0.7),transparent_38%),linear-gradient(135deg,#ffffff_0%,#faf9ff_48%,#eef7ff_100%)] px-4 pb-4 pt-5 sm:px-8 sm:pb-6 sm:pt-8 lg:px-10">
          <div className="grid gap-7 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div className="relative z-10 py-2">
              <h1 className="max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-indigo-950 sm:text-6xl lg:text-[4.35rem]">Снова задали <span className="text-violet-600">слова</span> к пятнице?</h1>
              <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-slate-600 sm:text-lg">AnnWord превращает слова из школьного задания в короткие игры с прогрессом, наградами и радостью от каждого нового успеха.</p>
              <button type="button" onClick={onStartKids} className="mt-7 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-4 text-lg font-black text-white shadow-xl shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:shadow-2xl">Начать бесплатно</button>
            </div>
            <div className="relative mx-auto w-full max-w-[41rem] overflow-hidden rounded-[2rem] shadow-2xl shadow-indigo-900/10"><img src={HERO_IMAGE} alt="Питомец AnnWord рядом с карточками ежедневной цели и наград" className="block aspect-[37/20] w-full object-cover" decoding="async" draggable={false} /></div>
          </div>
          <div className="relative mt-7 grid gap-2 rounded-[1.75rem] border border-indigo-50 bg-white/95 p-2 shadow-lg shadow-indigo-900/5 sm:grid-cols-2 lg:grid-cols-4">{trustItems.map(item => <article key={item.title} className="flex min-h-[5.5rem] items-center gap-3 rounded-2xl px-3 py-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-xl font-black text-indigo-600" aria-hidden="true">{item.icon}</div><div><h2 className="text-sm font-black leading-tight text-indigo-950">{item.title}</h2><p className="mt-1 text-[11px] font-bold leading-snug text-slate-400">{item.text}</p></div></article>)}</div>
        </section>

        <section className="bg-gradient-to-b from-indigo-50/30 to-white px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-[0.22em] text-violet-400">Знакомо?</div><h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-4xl">Почему обычная зубрёжка не работает</h2></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{problemCards.map((item, index) => <article key={item.title} className="overflow-hidden rounded-[1.75rem] border border-indigo-50 bg-white shadow-sm"><SpriteArt sprite={PROBLEM_SPRITE} index={index} count={4} label={item.title} className="aspect-[21/13] w-full bg-cover" /><div className="p-4 text-center"><h3 className="text-lg font-black text-indigo-950">{item.title}</h3><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{item.text}</p></div></article>)}</div>
        </section>

        <section className="px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><h2 className="text-2xl font-black text-indigo-950 sm:text-4xl">Как это работает?</h2><p className="mt-2 text-sm font-bold text-slate-500 sm:text-base">Три простых шага от списка слов до понятного результата.</p></div>
          <div className="mt-7 grid gap-3 lg:grid-cols-3">{parentSteps.map((step, index) => <article key={step.title} className="relative overflow-hidden rounded-[1.8rem] border border-indigo-50 bg-gradient-to-br from-white to-indigo-50/50 p-5 shadow-sm"><div className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-lg">{index + 1}</div><div className="grid min-h-[11rem] grid-cols-[7rem_1fr] items-center gap-3"><SpriteArt sprite={STEP_SPRITE} index={index} count={3} label={step.title} className="aspect-[22/29] w-[6.9rem] bg-cover" /><div><h3 className="text-lg font-black leading-tight text-indigo-950">{step.title}</h3><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{step.text}</p></div></div></article>)}</div>
        </section>

        <section className="border-y border-indigo-50 bg-indigo-50/35 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black uppercase tracking-[0.22em] text-violet-400">Реальный интерфейс</div><h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-4xl">Режимы игры</h2><p className="mt-2 text-sm font-bold text-slate-500 sm:text-base">Превью повторяют механику игровых экранов AnnWord, а не рекламные иллюстрации.</p></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{gameCards.map(({ title, subtitle, tone, Preview }) => <article key={title} className="overflow-hidden rounded-[1.65rem] border border-white bg-white shadow-lg shadow-indigo-900/5"><div className={`bg-gradient-to-r ${tone} px-4 py-3 text-center text-base font-black text-white`}>{title}</div><div className="h-[17.5rem] p-2"><Preview /></div><div className="px-3 pb-4 text-center text-xs font-black leading-snug text-indigo-900">{subtitle}</div></article>)}</div>
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-xs font-bold leading-relaxed text-blue-700">В «Виселице» нет изображения повешения: ошибки снимают сердечки. В «Змейке» ребёнок собирает английское слово по соседним клеткам.</div>
        </section>

        <section className="px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 sm:min-h-[18rem] sm:pr-48"><h2 className="text-2xl font-black text-indigo-950">Польза для ребёнка</h2><ul className="mt-5 space-y-3">{childBenefits.map(item => <li key={item} className="flex gap-2 text-sm font-bold leading-relaxed text-slate-600"><span className="mt-0.5 font-black text-emerald-500">✓</span><span>{item}</span></li>)}</ul><SpriteArt sprite={STEP_SPRITE} index={1} count={3} label="Ребёнок играет в AnnWord" className="mt-4 aspect-[22/29] w-32 bg-cover sm:absolute sm:bottom-0 sm:right-6 sm:mt-0 sm:w-36" /></article>
            <article className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 sm:min-h-[18rem] sm:pr-48"><h2 className="text-2xl font-black text-indigo-950">Польза для родителей</h2><ul className="mt-5 space-y-3">{parentBenefits.map(item => <li key={item} className="flex gap-2 text-sm font-bold leading-relaxed text-slate-600"><span className="mt-0.5 font-black text-blue-500">✓</span><span>{item}</span></li>)}</ul><SpriteArt sprite={STEP_SPRITE} index={0} count={3} label="Родитель добавляет слова" className="mt-4 aspect-[22/29] w-32 bg-cover sm:absolute sm:bottom-0 sm:right-6 sm:mt-0 sm:w-36" /></article>
          </div>
        </section>

        <section className="px-4 pb-8 sm:px-8 sm:pb-10 lg:px-10">
          <div className="overflow-hidden rounded-[2.1rem] bg-gradient-to-r from-indigo-700 via-violet-600 to-sky-500 p-5 text-white shadow-xl shadow-indigo-700/15 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr] lg:items-center">
              <div className="grid grid-cols-[8rem_1fr] items-center gap-3"><img src="/assets/pets/puppy/with-accessories/bow_hero_cape.webp" alt="Питомец AnnWord в плаще" loading="lazy" decoding="async" className="w-full object-contain drop-shadow-xl" draggable={false} /><div><h2 className="text-2xl font-black leading-tight sm:text-3xl">Мотивация, которая вдохновляет</h2><p className="mt-2 text-sm font-bold leading-relaxed text-indigo-100">Питомец растёт вместе с успехами ребёнка. Монеты, подарки и аксессуары делают путь к знаниям заметным и увлекательным.</p></div></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950"><img src="/assets/rewards/mystery-box.webp" alt="Секретная коробка" loading="lazy" decoding="async" className="mx-auto h-16 w-16 object-contain"/><div className="mt-2 text-xs font-black">Подарки</div></div><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950"><img src="/assets/pets/puppy/with-accessories/bow_hat.webp" alt="Шляпа для питомца" loading="lazy" decoding="async" className="mx-auto h-16 w-16 object-contain"/><div className="mt-2 text-xs font-black">Аксессуары</div></div><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950"><img src="/assets/pets/puppy/with-accessories/bow_glasses.webp" alt="Очки для питомца" loading="lazy" decoding="async" className="mx-auto h-16 w-16 object-contain"/><div className="mt-2 text-xs font-black">Новые образы</div></div><div className="rounded-2xl bg-white/95 p-3 text-center text-indigo-950"><img src="/assets/pets/puppy/base/idle.webp" alt="Питомец AnnWord" loading="lazy" decoding="async" className="mx-auto h-16 w-16 object-contain"/><div className="mt-2 text-xs font-black">Питомец</div></div></div>
            </div>
            <div className="mt-5 grid gap-2 rounded-[1.6rem] bg-white/95 p-3 text-indigo-950 sm:grid-cols-3"><div className="rounded-2xl bg-indigo-50 p-4"><div className="text-sm font-black">Без рекламы — гарантировано</div><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Никаких рекламных баннеров, роликов и сторонних вставок.</p></div><div className="rounded-2xl bg-indigo-50 p-4"><div className="text-sm font-black">Меньше уговоров</div><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Игры, питомец и награды дают ребёнку понятную цель вернуться.</p></div><div className="rounded-2xl bg-indigo-50 p-4"><div className="text-sm font-black">Результат перед глазами</div><p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Родитель видит прогресс и понимает, где ещё нужна практика.</p></div></div>
          </div>
        </section>

        <section className="px-4 pb-4 sm:px-8 sm:pb-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-600 px-5 py-7 text-white sm:px-8 sm:py-8"><div className="absolute -bottom-14 -right-8 h-48 w-48 rounded-full bg-white/10" aria-hidden="true"/><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><img src="/assets/pets/puppy/with-accessories/bow_hero_cape.webp" alt="Радостный питомец AnnWord" loading="lazy" decoding="async" className="hidden h-24 w-24 object-contain sm:block"/><div><h2 className="text-2xl font-black leading-tight sm:text-3xl">Начните учить слова в игре уже сегодня!</h2><p className="mt-2 text-sm font-bold text-indigo-100">Без рекламы. Без лишних отвлечений. С прогрессом, который видно.</p></div></div><button type="button" onClick={onStartKids} className="shrink-0 rounded-2xl bg-amber-300 px-7 py-4 text-lg font-black text-indigo-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-amber-200">Начать бесплатно</button></div></div>
        </section>
      </main>
    </ScreenContainer>
  );
};