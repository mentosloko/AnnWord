from pathlib import Path

path = Path('components/screens/LandingMixScreen.tsx')
text = path.read_text(encoding='utf-8')

start = text.index('const HeroScene = () => (')
end = text.index('\n\nconst ProblemVisual', start)
hero = '''const HeroScene = () => (
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
);'''
text = text[:start] + hero + text[end:]

replacements = [
    ('<main className="overflow-hidden bg-white">', '<main className="-mx-4 overflow-hidden bg-white sm:mx-0">'),
    ('className="relative z-20 mt-5 grid gap-1 rounded-[1.8rem] border border-white/80 bg-white/95 p-2 shadow-xl shadow-indigo-900/8 backdrop-blur sm:grid-cols-2 lg:grid-cols-4"', 'className="relative z-20 mt-4 grid grid-cols-2 gap-2 rounded-[1.6rem] border border-white/80 bg-white/95 p-2 shadow-xl shadow-indigo-900/8 backdrop-blur sm:mt-5 sm:grid-cols-2 sm:rounded-[1.8rem] lg:grid-cols-4"'),
    ('className="flex min-h-[4.75rem] items-center gap-3 rounded-[1.35rem] px-3 py-3 transition hover:bg-indigo-50/60"', 'className="flex min-h-[4.1rem] items-center gap-2 rounded-[1.1rem] px-2 py-2 transition hover:bg-indigo-50/60 sm:min-h-[4.75rem] sm:gap-3 sm:rounded-[1.35rem] sm:px-3 sm:py-3"'),
    ('className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${index === 1 ? \'bg-rose-50 text-rose-500\' : \'bg-indigo-50 text-indigo-600\'}`}', 'className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-black sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl ${index === 1 ? \'bg-rose-50 text-rose-500\' : \'bg-indigo-50 text-indigo-600\'}`}'),
    ('<h2 className="text-sm font-black leading-tight text-indigo-950">{item.title}</h2>', '<h2 className="text-[11px] font-black leading-tight text-indigo-950 sm:text-sm">{item.title}</h2>'),
    ('<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{problemCards.map', '<div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">{problemCards.map'),
    ('className="group overflow-hidden rounded-[2rem] border border-indigo-50 bg-white shadow-lg shadow-indigo-900/6 transition hover:-translate-y-1 hover:shadow-xl"', 'className="group min-w-[78vw] snap-center overflow-hidden rounded-[2rem] border border-indigo-50 bg-white shadow-lg shadow-indigo-900/6 transition hover:-translate-y-1 hover:shadow-xl sm:min-w-0"'),
    ('<div className="relative mt-8 grid gap-4 lg:grid-cols-3">', '<div className="relative -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">'),
    ('className="relative z-10 overflow-hidden rounded-[2rem] border border-indigo-50 bg-white p-4 shadow-lg shadow-indigo-900/6"', 'className="relative z-10 min-w-[84vw] snap-center overflow-hidden rounded-[2rem] border border-indigo-50 bg-white p-4 shadow-lg shadow-indigo-900/6 sm:min-w-0"'),
    ('<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{gameCards.map', '<div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">{gameCards.map'),
    ('className={`overflow-hidden rounded-[1.45rem] border-2 border-white bg-white shadow-lg ${glow} transition hover:-translate-y-1`}', 'className={`min-w-[78vw] snap-center overflow-hidden rounded-[1.45rem] border-2 border-white bg-white shadow-lg ${glow} transition hover:-translate-y-1 sm:min-w-0`}'),
    ('<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{petStages.map', '<div className="mt-5 grid grid-cols-4 gap-1.5 sm:mt-6 sm:gap-3">{petStages.map'),
    ('className="relative overflow-hidden rounded-[1.8rem] bg-white p-3 text-center shadow-md shadow-indigo-900/5"', 'className="relative overflow-hidden rounded-[1.2rem] bg-white p-1.5 text-center shadow-md shadow-indigo-900/5 sm:rounded-[1.8rem] sm:p-3"'),
    ('className="flex h-36 items-end justify-center overflow-hidden px-1 pb-0 pt-2 sm:h-40"', 'className="flex h-20 items-end justify-center overflow-hidden px-0.5 pb-0 pt-1 sm:h-40 sm:px-1 sm:pt-2"'),
    ('<div className="mt-3 text-sm font-black text-indigo-950">{label}</div>', '<div className="mt-1.5 text-[11px] font-black text-indigo-950 sm:mt-3 sm:text-sm">{label}</div>'),
    ('<div className="grid grid-cols-[9rem_1fr] items-center gap-2 sm:grid-cols-[11rem_1fr] sm:gap-3"><img src={asset(\'cta-mascot.webp\')} alt="Питомец AnnWord летит за наградами" loading="lazy" decoding="async" className="-my-4 -ml-3 h-40 w-40 max-w-none object-contain drop-shadow-2xl sm:h-44 sm:w-44" /><div><h2 className="text-2xl font-black leading-tight sm:text-3xl">Играй и получай награды!</h2><p className="mt-2 text-sm font-bold leading-relaxed text-indigo-100">Монеты, кристаллы и вещи для питомца превращают усилия в видимый результат.</p></div></div>', '<div className="flex items-center gap-3 sm:grid sm:grid-cols-[11rem_1fr]"><img src={asset(\'cta-mascot.webp\')} alt="Питомец AnnWord летит за наградами" loading="lazy" decoding="async" className="-ml-2 h-24 w-24 shrink-0 object-contain drop-shadow-2xl sm:-my-4 sm:-ml-3 sm:h-44 sm:w-44 sm:max-w-none" /><div><h2 className="text-xl font-black leading-tight sm:text-3xl">Играй и получай награды!</h2><p className="mt-1.5 text-xs font-bold leading-relaxed text-indigo-100 sm:mt-2 sm:text-sm">Монеты, кристаллы и вещи для питомца превращают усилия в видимый результат.</p></div></div>'),
    ('className="mt-5 w-full rounded-[1.6rem] object-cover shadow-lg sm:absolute sm:bottom-4 sm:right-4 sm:mt-0 sm:h-[calc(100%-2rem)] sm:w-[42%]"', 'className="mt-5 h-44 w-full rounded-[1.6rem] object-cover object-center shadow-lg sm:absolute sm:bottom-4 sm:right-4 sm:mt-0 sm:h-[calc(100%-2rem)] sm:w-[42%]"'),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Missing expected fragment:\n{old[:180]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Landing mobile rescue patch applied.')
