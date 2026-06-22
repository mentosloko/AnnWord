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

const copy: Record<Exclude<PublicModeEntryPath, 'teacher'>, { title: string; eyebrow: string; description: string; imageSrc: string; bullets: string[]; cta: string }> = {
  practice: {
    title: 'AnnWord Practice',
    eyebrow: 'Для самостоятельной практики',
    description: 'Тренируйте английские слова в коротких игровых режимах: классика, анаграммы, спринт, память, виселица, 1 из 2 и змейка.',
    imageSrc: '/assets/branding/annword-logo-mark.svg',
    bullets: ['Ежедневные задания и дни подряд', 'Статистика ошибок и слов к повторению', 'Premium и собственные словари'],
    cta: 'Создать Practice-аккаунт',
  },
  kids: {
    title: 'AnnWord Kids',
    eyebrow: 'Для ребёнка и родителя',
    description: 'Игры для ребёнка, питомец, награды и родительский кабинет в одном профиле.',
    imageSrc: '/assets/onboarding/account-mode-parent.webp',
    bullets: ['Игровой профиль ребёнка', 'Питомец и награды', 'Код преподавателя в Kids Premium'],
    cta: 'Создать Kids-профиль',
  },
};

const TeacherLanding: React.FC<Omit<ModeEntryScreenProps, 'entryPath'>> = ({ isAuthenticated, onLogin, onRegister, onBackHome }) => {
  const primaryCta = isAuthenticated ? 'Настроить кабинет преподавателя' : 'Создать кабинет и подключить первого ученика';
  return <ScreenContainer className="max-w-7xl pb-20 pt-6">
    <section className="overflow-hidden rounded-[2.5rem] border-2 border-cyan-50 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <button type="button" onClick={onBackHome} className="mb-7 rounded-2xl bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-700">← Все режимы</button>
          <div className="inline-flex rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600">AnnWord Teacher</div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.98] text-indigo-950 sm:text-6xl">Домашняя практика слов, которую преподаватель реально видит</h1>
          <p className="mt-5 max-w-2xl text-base font-bold leading-relaxed text-gray-600 sm:text-lg">Создайте кабинет преподавателя, подключайте детей по коду от родителя, назначайте словари и смотрите, какие слова ребёнок уже освоил, а какие нужно повторить на уроке.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onRegister} className="rounded-2xl bg-indigo-600 px-7 py-4 text-base font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">{primaryCta}</button>
            <button type="button" onClick={onLogin} className="rounded-2xl px-5 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-50">Уже есть аккаунт? Войти</button>
          </div>
          {isAuthenticated && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Вы уже вошли. Нажмите основной CTA, чтобы перейти к настройке режима аккаунта.</p>}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-cyan-50 p-4"><div className="text-2xl font-black text-cyan-700">1</div><div className="mt-2 text-sm font-black text-indigo-950">Родитель создаёт код ребёнка</div><p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">Код формируется в кабинете родителя, без передачи паролей и детских аккаунтов.</p></div>
            <div className="rounded-3xl bg-indigo-50 p-4"><div className="text-2xl font-black text-indigo-700">2</div><div className="mt-2 text-sm font-black text-indigo-950">Преподаватель подключает ученика</div><p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">Введите код один раз — ученик появляется в кабинете преподавателя.</p></div>
            <div className="rounded-3xl bg-purple-50 p-4"><div className="text-2xl font-black text-purple-700">3</div><div className="mt-2 text-sm font-black text-indigo-950">Назначает словарь и видит прогресс</div><p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">Сложные слова, исправленные ошибки и активный словарь видны в одном месте.</p></div>
          </div>
        </div>
        <aside className="relative min-h-[30rem] overflow-hidden bg-gradient-to-br from-cyan-700 via-indigo-700 to-purple-700 p-6 text-white sm:p-8 lg:p-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="text-xs font-black uppercase tracking-widest text-white/60">Кабинет преподавателя</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-3xl bg-white p-4 text-indigo-950"><div className="text-xs font-black uppercase text-indigo-400">Ученик</div><div className="mt-1 text-xl font-black">Анна</div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black"><span className="rounded-2xl bg-green-50 px-2 py-2 text-green-700">12 выучено</span><span className="rounded-2xl bg-rose-50 px-2 py-2 text-rose-700">5 к повтору</span><span className="rounded-2xl bg-indigo-50 px-2 py-2 text-indigo-700">35 слов</span></div></div>
              <div className="rounded-3xl bg-white/12 p-4"><div className="text-xs font-black uppercase tracking-widest text-white/55">Словарь недели</div><div className="mt-1 text-2xl font-black">Food and school</div><p className="mt-2 text-sm font-bold text-white/70">Назначьте подборку — ребёнок тренирует её в играх дома.</p></div>
              <div className="rounded-3xl bg-white/12 p-4"><div className="text-xs font-black uppercase tracking-widest text-white/55">На урок</div><div className="mt-2 flex flex-wrap gap-2 text-sm font-black"><span className="rounded-full bg-white/20 px-3 py-1">autumn</span><span className="rounded-full bg-white/20 px-3 py-1">friend</span><span className="rounded-full bg-white/20 px-3 py-1">school</span></div></div>
            </div>
          </div>
          <div className="relative mt-6 rounded-[2rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="text-xl font-black">Что получает преподаватель</div>
            <ul className="mt-4 space-y-3 text-sm font-bold leading-relaxed text-white/78">
              <li>✓ учеников по коду от родителей;</li>
              <li>✓ свои словари и тематические подборки;</li>
              <li>✓ статистику ошибок и слов к повторению;</li>
              <li>✓ понятный повод рекомендовать AnnWord родителям.</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
    <section className="mt-5 rounded-[2rem] border-2 border-indigo-50 bg-indigo-50/60 p-5 text-center sm:p-6">
      <div className="text-sm font-black uppercase tracking-widest text-indigo-400">Начните с одного ученика</div>
      <h2 className="mt-2 text-2xl font-black text-indigo-950 sm:text-3xl">Подключение занимает меньше минуты</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-bold leading-relaxed text-gray-600">Создайте кабинет, попросите родителя прислать код из Kids-профиля и назначьте первый словарь.</p>
      <button type="button" onClick={onRegister} className="mt-5 rounded-2xl bg-indigo-600 px-7 py-4 font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">{primaryCta}</button>
    </section>
  </ScreenContainer>;
};

export const ModeEntryScreen: React.FC<ModeEntryScreenProps> = ({ entryPath, isAuthenticated, onLogin, onRegister, onBackHome }) => {
  if (entryPath === 'teacher') return <TeacherLanding isAuthenticated={isAuthenticated} onLogin={onLogin} onRegister={onRegister} onBackHome={onBackHome} />;
  const item = copy[entryPath];
  return <ScreenContainer className="max-w-6xl pb-20 pt-6"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm sm:p-8"><div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-center"><div><button type="button" onClick={onBackHome} className="mb-6 rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">← Все режимы</button><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{item.eyebrow}</div><h1 className="mt-3 text-4xl font-black leading-tight text-indigo-950 sm:text-6xl">{item.title}</h1><p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-gray-600 sm:text-lg">{item.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{item.bullets.map(bullet => <div key={bullet} className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-800">{bullet}</div>)}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onRegister} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700">{isAuthenticated ? 'Настроить режим аккаунта' : item.cta}</button><button type="button" onClick={onLogin} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">Войти</button></div>{isAuthenticated && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Вы уже вошли. Если нужен другой режим, выберите его в настройке аккаунта или выйдите и создайте отдельный профиль.</p>}</div><aside className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-sky-600 p-6 text-white shadow-xl"><img src={item.imageSrc} alt="" aria-hidden="true" className="mx-auto h-44 w-44 rounded-[2rem] bg-white/15 object-contain p-4" draggable={false} /><div className="mt-6 text-2xl font-black">Отдельный адрес</div><div className="mt-2 rounded-2xl bg-white/15 px-4 py-3 font-mono text-sm font-black">/{entryPath}</div><p className="mt-4 text-sm font-bold leading-relaxed text-white/75">Эту страницу можно давать напрямую нужной аудитории.</p></aside></div></section></ScreenContainer>;
};