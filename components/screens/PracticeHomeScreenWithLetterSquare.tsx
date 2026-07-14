import React from 'react';
import { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../../types';
import { getDailyQuestTargetModes } from '../../services/dailyQuest';
import { hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { StreakBadge } from '../StreakBadge';
import { ScreenContainer } from '../layout/ScreenContainer';

type Props = {
  userProfile: UserProfile;
  dailyQuest?: DailyQuestState | null;
  dailyQuestReward?: DailyQuestCompletionReward | null;
  onCloseDailyQuestReward?: () => void;
  onStartDailyQuest?: (quest: DailyQuestState) => void;
  hasActiveClassicGame?: boolean;
  hasActiveAnagramGame?: boolean;
  activeDictionaryName?: string;
  onStartClassic: () => void;
  onStartAnagrams: () => void;
  onStartTranslation: () => void;
  onStartSprint: () => void;
  onStartHangman: () => void;
  onStartMemory: () => void;
  onStartLetterSquare: () => void;
  onOpenProfile?: () => void;
  onOpenDictionaryStudio?: () => void;
  onOpenPremium?: () => void;
};

type Card = { title: string; subtitle: string; description: string; imageSrc: string; badge?: string; accent: string; onStart: () => void };
const CardTile: React.FC<Card> = ({ title, subtitle, description, imageSrc, badge, accent, onStart }) => <button type="button" onClick={onStart} className="group relative flex min-h-[8.25rem] flex-col overflow-hidden rounded-[1.35rem] border-2 border-indigo-50 bg-white p-3 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-100 hover:shadow-xl sm:min-h-[11rem] sm:rounded-[1.75rem] sm:p-4"><div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />{badge && <span className="absolute right-2 top-2 hidden rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700 sm:inline-flex">{badge}</span>}<img src={imageSrc} alt="" aria-hidden="true" className="h-12 w-12 object-contain transition group-hover:scale-110 sm:h-16 sm:w-16" draggable={false} /><div className="mt-2 text-base font-black text-indigo-950 sm:text-xl">{title}</div><div className="mt-0.5 text-xs font-black text-indigo-600 sm:text-sm">{subtitle}</div><p className="mt-1.5 hidden flex-1 text-xs font-bold leading-relaxed text-gray-500 sm:block">{description}</p><span className="mt-3 inline-flex w-max rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-black text-white transition group-hover:bg-indigo-700 sm:px-4 sm:text-sm">Играть</span></button>;

export const PracticeHomeScreenWithLetterSquare: React.FC<Props> = ({ userProfile, dailyQuest, hasActiveClassicGame, hasActiveAnagramGame, activeDictionaryName, onStartDailyQuest, onStartClassic, onStartAnagrams, onStartTranslation, onStartSprint, onStartHangman, onStartMemory, onStartLetterSquare, onOpenDictionaryStudio, onOpenPremium }) => {
  const daysInRow = userProfile.pet.dailyStreak || 0;
  const questCompleted = dailyQuest?.completed === true;
  const dictionaryName = activeDictionaryName || (userProfile.customDictionaryEn.length ? 'Слова из вашего списка' : 'General English');
  const dailyQuestModes = new Set(getDailyQuestTargetModes(!questCompleted ? dailyQuest : null));
  const questBadge = (mode: Parameters<typeof dailyQuestModes.has>[0], fallback?: string) => dailyQuestModes.has(mode) ? 'задание дня' : fallback;
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const cards: Card[] = [
    { title: 'Классика', subtitle: 'угадать слово', description: 'Угадайте слово за 6 попыток.', imageSrc: '/assets/games/game_classic.webp', badge: questBadge('game', hasActiveClassicGame ? 'продолжить' : undefined), accent: 'bg-indigo-500', onStart: onStartClassic },
    { title: 'Анаграммы', subtitle: 'собрать слово', description: 'Тренирует написание и форму слова.', imageSrc: '/assets/games/game_anagrams.webp', badge: questBadge('anagrams', hasActiveAnagramGame ? 'сохранено' : undefined), accent: 'bg-purple-500', onStart: onStartAnagrams },
    { title: 'Змейка', subtitle: 'путь по буквам', description: 'Собирайте слово цепочкой. Только вверх, вниз, влево и вправо.', imageSrc: '/assets/games/line_game.webp', badge: 'новая', accent: 'bg-blue-500', onStart: onStartLetterSquare },
    { title: '1 из 2', subtitle: 'выбор перевода', description: 'Выберите правильный английский вариант.', imageSrc: '/assets/games/game_one_of_two.webp', badge: 'новая', accent: 'bg-pink-500', onStart: onStartTranslation },
    { title: 'Спринт', subtitle: 'на скорость', description: 'Короткая тренировка на скорость.', imageSrc: '/assets/games/game_sprint.webp', badge: questBadge('sprint', 'быстро'), accent: 'bg-green-500', onStart: onStartSprint },
    { title: 'Виселица', subtitle: 'по буквам', description: 'Вспоминайте слово постепенно.', imageSrc: '/assets/games/game_hangman.webp', badge: questBadge('hangman', 'без спешки'), accent: 'bg-amber-500', onStart: onStartHangman },
    { title: 'Память', subtitle: 'пары', description: 'Закрепляйте пары слово–перевод.', imageSrc: '/assets/games/game_memory.webp', badge: questBadge('memory', 'повторение'), accent: 'bg-cyan-500', onStart: onStartMemory },
  ];
  const runDailyQuest = () => dailyQuest && onStartDailyQuest ? onStartDailyQuest(dailyQuest) : onStartClassic();
  const scrollToGames = () => document.getElementById('practice-games-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <ScreenContainer className="max-w-7xl pb-20 pt-5"><section className="overflow-hidden rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-center"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">AnnWord Practice</div><div className="mt-2 flex items-start justify-between gap-3"><h1 className="text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">{questCompleted ? 'Практика на сегодня выполнена' : 'Ежедневная практика'}</h1>{questCompleted && <StreakBadge days={daysInRow} />}</div><p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-gray-600 sm:text-base">{questCompleted ? 'Можно сыграть ещё в любую игру или вернуться завтра.' : dailyQuest?.description || 'Сыграйте одну короткую тренировку, чтобы продлить дни подряд.'}</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={questCompleted ? scrollToGames : runDailyQuest} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:bg-indigo-700">{questCompleted ? 'Выбрать игру' : 'Начать ежедневную тренировку'}</button><button type="button" onClick={onOpenDictionaryStudio} className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700">Словарь</button></div></div><div className="relative hidden h-64 xl:block" aria-hidden="true"><img src="/assets/practice-mascot.webp" alt="" className="absolute bottom-[-2.25rem] right-[-1.5rem] h-[19rem] w-[34rem] max-w-none object-contain object-right-bottom" draggable={false} loading="eager" /></div></div></section><section id="practice-games-section" className="mt-6 grid gap-6 xl:grid-cols-[1fr_24rem]"><div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Игры</div><h2 className="mt-1 text-2xl font-black text-indigo-950">Выберите режим</h2></div><div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{cards.map(card => <CardTile key={card.title} {...card} />)}</div></div><aside className="space-y-4"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Активный словарь</div><h2 className="mt-2 text-2xl font-black text-indigo-950">{dictionaryName}</h2><p className="mt-2 text-sm font-bold text-gray-500">Используется во всех выбранных играх.</p><button type="button" onClick={onOpenDictionaryStudio} className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">Сменить словарь</button></section>{!hasPremium && onOpenPremium && <button type="button" onClick={onOpenPremium} className="w-full rounded-[2rem] border-2 border-amber-100 bg-amber-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100/70"><div className="text-xs font-black uppercase tracking-widest text-amber-600">Premium</div><h2 className="mt-2 text-xl font-black text-indigo-950">Учите слова под свою цель</h2><p className="mt-2 text-sm font-bold leading-relaxed text-gray-600">Работа, экзамен, медицина, поездка или слова из вашего списка.</p><span className="mt-4 inline-flex rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">Собрать тренировку</span></button>}</aside></section></ScreenContainer>;
};