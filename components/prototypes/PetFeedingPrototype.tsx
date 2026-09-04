import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface Treat {
  id: string;
  name: string;
  shortName: string;
  image: string;
  mood: number;
  price: number;
  phrase: string;
}

type DemoScreen = 'shop' | 'room';
type Inventory = Record<string, number>;

const TREATS: Treat[] = [
  { id: 'apple', name: 'Энерго-яблоко', shortName: 'Яблоко', image: '/assets/items/treats/energy_apple.webp', mood: 8, price: 4, phrase: 'Ммм! Яблоко! Спасибо! 😋' },
  { id: 'cookie', name: 'Хрустик', shortName: 'Хрустик', image: '/assets/items/treats/crunchik.webp', mood: 12, price: 7, phrase: 'Хрум-хрум! Как вкусно! 💛' },
  { id: 'berry', name: 'Сияющая ягодка', shortName: 'Ягодка', image: '/assets/items/treats/glowing_berry.webp', mood: 16, price: 11, phrase: 'Ух ты! Она сияет! ✨' },
];

const INITIAL_INVENTORY: Inventory = { apple: 0, cookie: 0, berry: 0 };
const clampMood = (value: number) => Math.max(0, Math.min(100, value));

const DemoHeader: React.FC<{ screen: DemoScreen; onShop: () => void; onRoom: () => void; onReset: () => void }> = ({ screen, onShop, onRoom, onReset }) => (
  <header className="mb-3 flex items-start justify-between gap-3 sm:mb-5 sm:items-center">
    <div className="min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-400 sm:text-xs">AnnWord prototype · shop → pet</div>
      <h1 className="truncate text-xl font-black text-indigo-950 sm:text-3xl">{screen === 'shop' ? 'Магазин' : 'Комната питомца'}</h1>
    </div>
    <div className="flex shrink-0 gap-1.5 sm:gap-2">
      <button type="button" onClick={screen === 'shop' ? onRoom : onShop} className="rounded-xl bg-white px-2.5 py-2 text-xs font-black text-indigo-600 shadow-sm ring-1 ring-indigo-100 sm:px-3">
        {screen === 'shop' ? '🐶 К Рэю' : '🛍️ В магазин'}
      </button>
      <button type="button" onClick={onReset} className="rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-black text-indigo-500 sm:px-3">Сброс</button>
    </div>
  </header>
);

export const PetFeedingPrototype: React.FC = () => {
  const [screen, setScreen] = useState<DemoScreen>('shop');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mood, setMood] = useState(43);
  const [speech, setSpeech] = useState('Мне немного грустно. Угостишь меня?');
  const [inventory, setInventory] = useState<Inventory>(INITIAL_INVENTORY);
  const [coins, setCoins] = useState(35);
  const [lastBought, setLastBought] = useState<Treat | null>(null);
  const [reaction, setReaction] = useState<{ id: string; delta: number; image: string } | null>(null);
  const [burst, setBurst] = useState(0);

  const moodLabel = useMemo(() => mood >= 70 ? 'Радость' : mood >= 34 ? 'Спокойно' : 'Грусть', [mood]);
  const ownedTreats = useMemo(() => TREATS.filter(treat => (inventory[treat.id] || 0) > 0), [inventory]);

  const resetDemo = () => {
    setScreen('shop');
    setPickerOpen(false);
    setMood(43);
    setSpeech('Мне немного грустно. Угостишь меня?');
    setInventory(INITIAL_INVENTORY);
    setCoins(35);
    setLastBought(null);
    setReaction(null);
    setBurst(0);
  };

  const buy = (treat: Treat) => {
    if (coins < treat.price) return;
    setCoins(value => value - treat.price);
    setInventory(items => ({ ...items, [treat.id]: (items[treat.id] || 0) + 1 }));
    setLastBought(treat);
  };

  const goFeedPurchased = () => {
    setLastBought(null);
    setScreen('room');
    setSpeech('Ого! Ты принёс мне лакомство? 😍');
    window.setTimeout(() => setPickerOpen(true), 250);
  };

  const feed = (treat: Treat) => {
    const quantity = inventory[treat.id] || 0;
    if (quantity <= 0) return;
    setPickerOpen(false);
    const previousMood = mood;
    const nextMood = clampMood(previousMood + treat.mood);
    setInventory(items => ({ ...items, [treat.id]: Math.max(0, (items[treat.id] || 0) - 1) }));
    setSpeech(nextMood >= 70 && previousMood < 70 ? 'Ура! Теперь у меня отличное настроение! 🌟' : treat.phrase);
    setReaction({ id: `${treat.id}-${Date.now()}`, delta: nextMood - previousMood, image: treat.image });
    setBurst(value => value + 1);
    window.setTimeout(() => setMood(nextMood), 260);
    window.setTimeout(() => setReaction(null), 1450);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 text-slate-900">
      <div className="mx-auto min-h-screen max-w-6xl px-3 py-3 sm:px-5 sm:py-5">
        <DemoHeader screen={screen} onShop={() => { setPickerOpen(false); setScreen('shop'); }} onRoom={() => setScreen('room')} onReset={resetDemo} />

        <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/90 px-3 py-2 shadow-sm ring-1 ring-indigo-100 sm:mb-5 sm:px-4 sm:py-3">
          <div className="text-xs font-bold text-slate-500"><span className="font-black text-indigo-700">Демо-сценарий:</span> покупка → «Угостить Рэя» → выбор → реакция</div>
          <div className="ml-3 shrink-0 rounded-full bg-yellow-50 px-3 py-1.5 text-sm font-black text-yellow-700">{coins} 🪙</div>
        </div>

        {screen === 'shop' ? (
          <section>
            <div className="mb-4">
              <div className="text-xs font-black uppercase tracking-wider text-violet-400">Лакомства</div>
              <h2 className="mt-1 text-2xl font-black text-indigo-950 sm:text-3xl">Выбери что-нибудь для Рэя</h2>
              <p className="mt-1 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">После покупки не нужно искать предмет в профиле: экран покупки сразу предлагает пойти к питомцу и угостить его.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TREATS.map(treat => {
                const quantity = inventory[treat.id] || 0;
                return (
                  <article key={treat.id} className="rounded-[1.75rem] border border-indigo-100 bg-white p-4 shadow-lg shadow-indigo-100/40 sm:p-5">
                    <div className="flex items-center gap-4 sm:block">
                      <div className="relative h-24 w-24 shrink-0 rounded-[1.5rem] bg-gradient-to-br from-violet-50 to-indigo-50 p-3 sm:mx-auto sm:h-36 sm:w-36 sm:p-5">
                        <img src={treat.image} alt="" className="h-full w-full object-contain" />
                        {quantity > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-pink-500 px-2 py-1 text-xs font-black text-white">у тебя ×{quantity}</span>}
                      </div>
                      <div className="min-w-0 flex-1 sm:mt-4 sm:text-center">
                        <h3 className="font-black text-indigo-950 sm:text-lg">{treat.name}</h3>
                        <div className="mt-1 text-sm font-black text-emerald-600">+{treat.mood} к настроению</div>
                        <div className="mt-2 text-lg font-black text-yellow-700">{treat.price} 🪙</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => buy(treat)} disabled={coins < treat.price} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-indigo-600/15 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                      Купить
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="relative aspect-[11/9] w-full overflow-hidden rounded-[2rem] border border-indigo-100 bg-[#f5eadb] shadow-xl shadow-indigo-100/50">
                <img src="/assets/rooms/puppy/background.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/10 via-transparent to-white/10" />

                <div className="absolute left-2.5 top-2.5 z-20 rounded-xl bg-white/92 px-2.5 py-2 shadow-sm backdrop-blur sm:left-5 sm:top-5 sm:rounded-2xl sm:px-4 sm:py-3">
                  <div className="hidden text-xs font-black uppercase tracking-wider text-indigo-300 sm:block">Настроение</div>
                  <div className="flex items-center gap-1.5 sm:mt-1 sm:gap-2">
                    <span className="text-xs font-black text-indigo-950 sm:text-lg">{moodLabel}</span>
                    <motion.span key={mood} initial={{ scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-xs font-black text-emerald-600 sm:text-sm">{mood}%</motion.span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-indigo-100 sm:mt-2 sm:h-2.5 sm:w-48">
                    <motion.div className="h-full rounded-full bg-indigo-500" animate={{ width: `${mood}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
                  </div>
                </div>

                <motion.div
                  key={`pet-${burst}`}
                  initial={false}
                  animate={reaction ? { y: [0, -12, 0], rotate: [0, -3, 3, 0], scale: [1, 1.07, 1] } : { y: [0, -4, 0] }}
                  transition={reaction ? { duration: 0.7, ease: 'easeOut' } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute bottom-[7%] left-1/2 z-10 h-[48%] w-[48%] -translate-x-1/2 sm:h-[52%] sm:w-[52%]"
                >
                  <img src="/assets/pets/puppy/base/idle.webp" alt="Щенок Рэй" className="h-full w-full object-contain drop-shadow-2xl" draggable={false} />
                </motion.div>

                <AnimatePresence>
                  {reaction && (
                    <>
                      <motion.img key={`${reaction.id}-treat`} src={reaction.image} alt="" aria-hidden="true" initial={{ opacity: 0, y: 55, x: -65, scale: 0.65, rotate: -12 }} animate={{ opacity: [0, 1, 1, 0], y: [55, 10, -8, -20], x: [-65, -35, -10, 0], scale: [0.65, 0.9, 0.72, 0.5], rotate: [-12, 4, 0, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="pointer-events-none absolute bottom-[34%] left-1/2 z-20 h-[12%] w-[12%] object-contain" />
                      <motion.div key={`${reaction.id}-burst`} aria-hidden="true" initial={{ opacity: 0, y: 16, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], y: [16, -4, -38, -58], scale: [0.5, 1.2, 1, 0.9] }} transition={{ duration: 1.35, delay: 0.25 }} className="pointer-events-none absolute bottom-[48%] left-1/2 z-30 -translate-x-1/2 text-2xl drop-shadow sm:text-5xl">✨ 💛 ✨</motion.div>
                      <motion.div key={`${reaction.id}-delta`} initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: [10, -4, -18, -26], scale: [0.8, 1.12, 1, 0.95] }} transition={{ duration: 1.2, delay: 0.35 }} className="pointer-events-none absolute bottom-[29%] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-black text-white shadow-lg sm:px-4 sm:py-2 sm:text-lg">+{reaction.delta} настроение</motion.div>
                    </>
                  )}
                </AnimatePresence>

                <motion.div key={speech} role="status" aria-live="polite" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute right-2.5 top-[20%] z-20 w-[52%] rounded-2xl bg-white/95 px-3 py-2 text-center text-[11px] font-black leading-snug text-indigo-950 shadow-lg backdrop-blur sm:right-6 sm:top-[16%] sm:w-[min(48%,22rem)] sm:rounded-[1.6rem] sm:px-5 sm:py-4 sm:text-lg">
                  “{speech}”
                </motion.div>
              </div>

              <div className="mt-3 rounded-[1.5rem] border border-indigo-100 bg-white p-3 shadow-sm lg:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-indigo-300">Лакомства у тебя</div>
                    <div className="mt-0.5 text-sm font-black text-indigo-950">{ownedTreats.length ? `${ownedTreats.reduce((sum, treat) => sum + (inventory[treat.id] || 0), 0)} шт.` : 'Пока пусто'}</div>
                  </div>
                  {ownedTreats.length ? (
                    <button type="button" onClick={() => setPickerOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-900/15 active:scale-[0.98]">🍎 Покормить</button>
                  ) : (
                    <button type="button" onClick={() => setScreen('shop')} className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white">В магазин</button>
                  )}
                </div>
              </div>
            </div>

            <aside className="hidden rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-xl shadow-indigo-100/50 lg:block">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-300">Мои лакомства</div>
              <h2 className="mt-1 text-2xl font-black text-indigo-950">Чем угостим Рэя?</h2>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">После перехода из магазина купленное лакомство уже здесь. Питомец всё время остаётся перед глазами.</p>
              <div className="mt-5 grid gap-3">
                {ownedTreats.length ? ownedTreats.map(treat => (
                  <button key={treat.id} type="button" onClick={() => feed(treat)} className="group flex items-center gap-3 rounded-2xl border-2 border-indigo-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50">
                    <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-indigo-50 p-2">
                      <img src={treat.image} alt="" className="h-full w-full object-contain transition group-hover:scale-110" />
                      <span className="absolute -right-1 -top-1 rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white">×{inventory[treat.id] || 0}</span>
                    </div>
                    <div className="min-w-0 flex-1"><div className="font-black text-indigo-950">{treat.name}</div><div className="mt-1 text-sm font-black text-emerald-600">+{treat.mood} настроение</div></div>
                    <span className="text-xl text-indigo-300">→</span>
                  </button>
                )) : <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-700">Лакомств нет. Сначала купи что-нибудь в магазине.</div>}
              </div>
              <button type="button" onClick={() => setScreen('shop')} className="mt-5 w-full rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-600 transition hover:bg-indigo-100">🛍️ В магазин</button>
            </aside>
          </section>
        )}
      </div>

      <AnimatePresence>
        {lastBought && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-5">
            <motion.button type="button" aria-label="Закрыть результат покупки" onClick={() => setLastBought(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-indigo-950/40 backdrop-blur-[2px]" />
            <motion.section role="dialog" aria-modal="true" aria-label="Лакомство куплено" initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.98 }} className="relative z-10 w-full max-w-md rounded-t-[2rem] bg-white p-5 text-center shadow-2xl sm:rounded-[2rem] sm:p-7">
              <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: [0.6, 1.1, 1], rotate: [-8, 4, 0] }} className="mx-auto h-28 w-28 rounded-[2rem] bg-gradient-to-br from-violet-50 to-pink-50 p-4 sm:h-36 sm:w-36"><img src={lastBought.image} alt="" className="h-full w-full object-contain" /></motion.div>
              <div className="mt-3 text-3xl" aria-hidden="true">✨ 🎁 ✨</div>
              <h2 className="mt-2 text-2xl font-black text-indigo-950">{lastBought.name} теперь у тебя!</h2>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Лакомство добавлено в твои предметы. Можно сразу порадовать Рэя.</p>
              <button type="button" onClick={goFeedPurchased} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-violet-900/15 active:scale-[0.98]">🐶 Угостить Рэя →</button>
              <button type="button" onClick={() => setLastBought(null)} className="mt-2 w-full rounded-2xl bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-600">Продолжить покупки</button>
            </motion.section>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pickerOpen && screen === 'room' && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.button type="button" aria-label="Закрыть выбор лакомства" onClick={() => setPickerOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-indigo-950/25 backdrop-blur-[1px]" />
            <motion.section role="dialog" aria-modal="true" aria-label="Выбор лакомства" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="absolute inset-x-0 bottom-0 max-h-[48vh] rounded-t-[2rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div><div className="text-xs font-black uppercase tracking-wider text-indigo-300">Мои лакомства</div><h2 className="text-xl font-black text-indigo-950">Чем угостим Рэя?</h2></div>
                <button type="button" onClick={() => setPickerOpen(false)} className="h-10 w-10 rounded-full bg-indigo-50 text-lg font-black text-indigo-500">×</button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {ownedTreats.map(treat => (
                  <button key={treat.id} type="button" onClick={() => feed(treat)} className="relative flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 border-indigo-50 bg-white p-2 text-center active:scale-[0.97]">
                    <div className="relative h-16 w-16"><img src={treat.image} alt="" className="h-full w-full object-contain" /><span className="absolute -right-2 -top-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-black text-white">×{inventory[treat.id] || 0}</span></div>
                    <div className="mt-1 text-xs font-black text-indigo-950">{treat.shortName}</div><div className="text-[11px] font-black text-emerald-600">+{treat.mood}</div>
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
