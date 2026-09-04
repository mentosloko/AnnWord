import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface Treat {
  id: string;
  name: string;
  shortName: string;
  image: string;
  quantity: number;
  mood: number;
  phrase: string;
}

const INITIAL_TREATS: Treat[] = [
  { id: 'apple', name: 'Энерго-яблоко', shortName: 'Яблоко', image: '/assets/items/treats/energy_apple.webp', quantity: 3, mood: 8, phrase: 'Ммм! Яблоко! Спасибо! 😋' },
  { id: 'cookie', name: 'Хрустик', shortName: 'Хрустик', image: '/assets/items/treats/crunchik.webp', quantity: 2, mood: 12, phrase: 'Хрум-хрум! Как вкусно! 💛' },
  { id: 'berry', name: 'Сияющая ягодка', shortName: 'Ягодка', image: '/assets/items/treats/glowing_berry.webp', quantity: 1, mood: 16, phrase: 'Ух ты! Она сияет! ✨' },
];

const clampMood = (value: number) => Math.max(0, Math.min(100, value));

export const PetFeedingPrototype: React.FC = () => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mood, setMood] = useState(43);
  const [speech, setSpeech] = useState('Мне немного грустно. Угостишь меня?');
  const [treats, setTreats] = useState(INITIAL_TREATS);
  const [reaction, setReaction] = useState<{ id: string; delta: number; image: string } | null>(null);
  const [burst, setBurst] = useState(0);

  const moodLabel = useMemo(() => mood >= 70 ? 'Радость' : mood >= 34 ? 'Спокойно' : 'Грусть', [mood]);

  const feed = (treat: Treat) => {
    if (treat.quantity <= 0) return;
    setPickerOpen(false);
    const previousMood = mood;
    const nextMood = clampMood(previousMood + treat.mood);
    setTreats(items => items.map(item => item.id === treat.id ? { ...item, quantity: item.quantity - 1 } : item));
    setSpeech(nextMood >= 70 && previousMood < 70 ? 'Ура! Теперь у меня отличное настроение! 🌟' : treat.phrase);
    setReaction({ id: `${treat.id}-${Date.now()}`, delta: nextMood - previousMood, image: treat.image });
    setBurst(value => value + 1);
    window.setTimeout(() => setMood(nextMood), 260);
    window.setTimeout(() => setReaction(null), 1450);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 text-slate-900">
      <div className="mx-auto min-h-screen max-w-6xl px-3 py-3 sm:px-5 sm:py-5">
        <header className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">AnnWord prototype</div>
            <h1 className="text-xl font-black text-indigo-950 sm:text-3xl">Кормление питомца</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-indigo-500 shadow-sm ring-1 ring-indigo-100">Только демо · данные не сохраняются</span>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-h-[570px] overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-xl shadow-indigo-100/50 sm:min-h-[650px]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/assets/rooms/puppy/background.webp')" }} />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/10 via-transparent to-white/10" />

            <div className="absolute left-4 top-4 z-10 rounded-2xl bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:left-6 sm:top-6">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-300">Настроение</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-black text-indigo-950">{moodLabel}</span>
                <motion.span key={mood} initial={{ scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-sm font-black text-emerald-600">{mood}%</motion.span>
              </div>
              <div className="mt-2 h-2.5 w-36 overflow-hidden rounded-full bg-indigo-100 sm:w-48">
                <motion.div className="h-full rounded-full bg-indigo-500" animate={{ width: `${mood}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
              </div>
            </div>

            <motion.div
              key={`pet-${burst}`}
              initial={false}
              animate={reaction ? { y: [0, -18, 0], rotate: [0, -3, 3, 0], scale: [1, 1.07, 1] } : { y: [0, -5, 0] }}
              transition={reaction ? { duration: 0.7, ease: 'easeOut' } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-24 left-1/2 z-10 h-64 w-64 -translate-x-1/2 sm:bottom-28 sm:h-80 sm:w-80"
            >
              <img src="/assets/pets/puppy/base/idle.webp" alt="Щенок Рэй" className="h-full w-full object-contain drop-shadow-2xl" draggable={false} />
            </motion.div>

            <AnimatePresence>
              {reaction && (
                <>
                  <motion.img
                    key={`${reaction.id}-treat`}
                    src={reaction.image}
                    alt=""
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 90, x: -95, scale: 0.65, rotate: -12 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [90, 20, -15, -35], x: [-95, -45, -15, 0], scale: [0.65, 0.9, 0.72, 0.5], rotate: [-12, 4, 0, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="pointer-events-none absolute bottom-52 left-1/2 z-20 h-16 w-16 object-contain sm:bottom-60 sm:h-20 sm:w-20"
                  />
                  <motion.div
                    key={`${reaction.id}-burst`}
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 20, scale: 0.5 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [20, -5, -55, -85], scale: [0.5, 1.2, 1, 0.9] }}
                    transition={{ duration: 1.35, delay: 0.25 }}
                    className="pointer-events-none absolute bottom-72 left-1/2 z-30 -translate-x-1/2 text-4xl drop-shadow sm:bottom-80 sm:text-5xl"
                  >
                    ✨ 💛 ✨
                  </motion.div>
                  <motion.div
                    key={`${reaction.id}-delta`}
                    initial={{ opacity: 0, y: 12, scale: 0.8 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [12, -6, -25, -34], scale: [0.8, 1.15, 1, 0.95] }}
                    transition={{ duration: 1.2, delay: 0.35 }}
                    className="pointer-events-none absolute bottom-48 left-1/2 z-30 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-lg font-black text-white shadow-lg sm:bottom-56"
                  >
                    +{reaction.delta} настроение
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <motion.div
              key={speech}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute left-1/2 top-[115px] z-20 w-[min(86%,22rem)] -translate-x-1/2 rounded-[1.6rem] bg-white/95 px-5 py-4 text-center text-base font-black text-indigo-950 shadow-lg backdrop-blur sm:top-[105px] sm:text-lg"
            >
              “{speech}”
            </motion.div>

            <div className="absolute inset-x-0 bottom-0 z-40 p-3 sm:p-5 lg:hidden">
              <button type="button" onClick={() => setPickerOpen(true)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-4 text-lg font-black text-white shadow-xl shadow-violet-900/20 active:scale-[0.98]">
                <span aria-hidden="true">🍎</span> Покормить
              </button>
            </div>
          </div>

          <aside className="hidden rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-xl shadow-indigo-100/50 lg:block">
            <div className="text-xs font-black uppercase tracking-wider text-indigo-300">Лакомства</div>
            <h2 className="mt-1 text-2xl font-black text-indigo-950">Чем угостим Рэя?</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Питомец остаётся перед глазами. Нажмите на лакомство — панель не перекрывает сцену.</p>
            <div className="mt-5 grid gap-3">
              {treats.map(treat => (
                <button key={treat.id} type="button" disabled={treat.quantity <= 0} onClick={() => feed(treat)} className="group flex items-center gap-3 rounded-2xl border-2 border-indigo-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">
                  <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-indigo-50 p-2">
                    <img src={treat.image} alt="" className="h-full w-full object-contain transition group-hover:scale-110" />
                    <span className="absolute -right-1 -top-1 rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white">×{treat.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-indigo-950">{treat.name}</div>
                    <div className="mt-1 text-sm font-black text-emerald-600">+{treat.mood} настроение</div>
                  </div>
                  <span className="text-xl text-indigo-300">→</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setMood(43); setSpeech('Мне немного грустно. Угостишь меня?'); setTreats(INITIAL_TREATS); setReaction(null); }} className="mt-5 w-full rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-600 transition hover:bg-indigo-100">Сбросить демо</button>
          </aside>
        </section>
      </div>

      <AnimatePresence>
        {pickerOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.button type="button" aria-label="Закрыть выбор лакомства" onClick={() => setPickerOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-indigo-950/35 backdrop-blur-[1px]" />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Выбор лакомства"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="absolute inset-x-0 bottom-0 max-h-[52vh] rounded-t-[2rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div><div className="text-xs font-black uppercase tracking-wider text-indigo-300">Лакомства</div><h2 className="text-xl font-black text-indigo-950">Чем угостим Рэя?</h2></div>
                <button type="button" onClick={() => setPickerOpen(false)} className="h-10 w-10 rounded-full bg-indigo-50 text-lg font-black text-indigo-500">×</button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {treats.map(treat => (
                  <button key={treat.id} type="button" disabled={treat.quantity <= 0} onClick={() => feed(treat)} className="relative flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 border-indigo-50 bg-white p-2 text-center active:scale-[0.97] disabled:opacity-40">
                    <div className="relative h-16 w-16">
                      <img src={treat.image} alt="" className="h-full w-full object-contain" />
                      <span className="absolute -right-2 -top-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-black text-white">×{treat.quantity}</span>
                    </div>
                    <div className="mt-1 text-xs font-black text-indigo-950">{treat.shortName}</div>
                    <div className="text-[11px] font-black text-emerald-600">+{treat.mood}</div>
                  </button>
                ))}
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default PetFeedingPrototype;
