import React from 'react';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

type Props = {
  userProfile: UserProfile;
  hasActiveClassicGame?: boolean;
  hasActiveAnagramGame?: boolean;
  onStartClassic: () => void;
  onStartAnagrams: () => void;
  onStartSprint: () => void;
  onStartHangman: () => void;
  onStartMemory: () => void;
  onOpenProfile?: () => void;
  onOpenDictionaryStudio?: () => void;
};

const t = {
  title: 'AnnWord Practice',
  subtitle: 'Взрослый тренажёр для ежедневной практики английских слов. Без питомцев, монет и лакомств.',
  start: 'Начать практику',
  dictionary: 'Словари',
  profile: 'Статистика',
  games: 'тренировок',
  wins: 'успешных',
  words: 'слов в словаре',
  repeat: 'Режимы практики',
};
const modes = [
  ['Классика', '/assets/games/game_classic.webp'],
  ['Анаграммы', '/assets/games/game_anagrams.webp'],
  ['Спринт', '/assets/games/game_sprint.webp'],
  ['Виселица', '/assets/games/game_hangman.webp'],
  ['Память', '/assets/games/game_memory.webp'],
] as const;
const PRACTICE_IMAGE = '/assets/onboarding/account-mode-player.webp';
const Stat = ({ value, label }: { value: number; label: string }) => <div className="rounded-3xl border border-indigo-100 bg-white p-5"><div className="text-3xl font-black text-indigo-950">{value}</div><div className="mt-1 text-xs font-black uppercase tracking-widest text-indigo-400">{label}</div></div>;

export const PracticeHomeScreen: React.FC<Props> = ({ userProfile, hasActiveClassicGame, hasActiveAnagramGame, onStartClassic, onStartAnagrams, onStartSprint, onStartHangman, onStartMemory, onOpenProfile, onOpenDictionaryStudio }) => {
  const actions = [onStartClassic, onStartAnagrams, onStartSprint, onStartHangman, onStartMemory];
  return <ScreenContainer className="max-w-6xl pb-20 pt-6"><section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"><div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 to-sky-600 p-6 text-white shadow-xl sm:p-8"><div className="grid gap-5 lg:grid-cols-[1fr_15rem] lg:items-center"><div><div className="text-xs font-black uppercase tracking-widest text-white/70">{t.title}</div><h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">{t.start}</h1><p className="mt-4 max-w-xl text-sm font-bold leading-relaxed text-white/75 sm:text-base">{t.subtitle}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onStartClassic} className="rounded-2xl bg-white px-6 py-3 font-black text-indigo-700">{t.start}</button><button type="button" onClick={onOpenDictionaryStudio} className="rounded-2xl bg-white/15 px-6 py-3 font-black text-white hover:bg-white/20">{t.dictionary}</button><button type="button" onClick={onOpenProfile} className="rounded-2xl bg-white/15 px-6 py-3 font-black text-white hover:bg-white/20">{t.profile}</button></div></div><div className="hidden justify-center lg:flex"><div className="rounded-[2rem] border border-white/20 bg-white/15 p-5 shadow-2xl backdrop-blur"><img src={PRACTICE_IMAGE} alt="" aria-hidden="true" className="h-52 w-52 object-contain drop-shadow-2xl" draggable={false} /></div></div></div></div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><Stat value={userProfile.stats.gamesPlayed} label={t.games} /><Stat value={userProfile.stats.gamesWon} label={t.wins} /><Stat value={userProfile.customDictionaryEn.length} label={t.words} /></div></section><section className="mt-6 rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="mb-4 text-sm font-black uppercase tracking-widest text-indigo-400">{t.repeat}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{modes.map(([label, src], index) => <button key={label} type="button" onClick={actions[index]} className="relative rounded-3xl border-2 border-indigo-50 bg-indigo-50/40 p-3 text-center transition hover:-translate-y-1 hover:bg-indigo-50"><img src={src} alt="" className="mx-auto h-16 w-16 object-contain" draggable={false} /><div className="mt-2 text-sm font-black text-indigo-950">{label}</div>{((index === 0 && hasActiveClassicGame) || (index === 1 && hasActiveAnagramGame)) && <div className="absolute right-2 top-2 rounded-full bg-green-100 px-2 py-1 text-[10px] font-black text-green-700">save</div>}</button>)}</div></section></ScreenContainer>;
};
