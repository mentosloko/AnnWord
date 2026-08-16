from pathlib import Path

path = Path('components/screens/LandingMixScreen.tsx')
text = path.read_text()

old_pet = '''<div className="flex h-36 items-end justify-center overflow-hidden rounded-[1.4rem] bg-gradient-to-b from-violet-50 via-white to-blue-50 p-3 sm:h-40"><img src={src} alt={label} loading="lazy" decoding="async" className="h-full w-full object-contain object-bottom drop-shadow-lg" /></div>'''
new_pet = '''<div className="flex h-36 items-end justify-center overflow-hidden px-1 pb-0 pt-2 sm:h-40"><img src={src} alt={label} loading="lazy" decoding="async" className={`h-full w-full origin-bottom object-contain object-bottom drop-shadow-lg transform-gpu ${index === 0 ? 'scale-[0.78]' : index === 1 ? 'scale-[0.88]' : index === 2 ? 'scale-[0.96]' : 'scale-[1.03]'}`} /></div>'''
if old_pet not in text:
    raise SystemExit('Pet stage viewport markup not found')
text = text.replace(old_pet, new_pet, 1)

old_reward = '''<div className="grid grid-cols-[7rem_1fr] items-center gap-3"><img src={asset('pet-stage-4.webp')} alt="Питомец AnnWord — герой" loading="lazy" decoding="async" className="w-full object-contain drop-shadow-2xl" />'''
new_reward = '''<div className="grid grid-cols-[9rem_1fr] items-center gap-2 sm:grid-cols-[11rem_1fr] sm:gap-3"><img src={asset('cta-mascot.webp')} alt="Питомец AnnWord летит за наградами" loading="lazy" decoding="async" className="-my-4 -ml-3 h-40 w-40 max-w-none object-contain drop-shadow-2xl sm:h-44 sm:w-44" />'''
if old_reward not in text:
    raise SystemExit('Reward mascot markup not found')
text = text.replace(old_reward, new_reward, 1)

path.write_text(text)
