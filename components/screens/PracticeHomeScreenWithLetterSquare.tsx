import React from 'react';
import { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../../types';
import { getDailyQuestTargetModes } from '../../services/dailyQuest';
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
  activeDictionaryWordCount?: number;
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
const CardTile: React.FC<Card> = ({ title, subtitle, description, imageSrc, badge, accent, onStart }) => <button type="button" onClick={onStart} className="group relative flex min-h-[9rem] flex-col overflow-hidden rounded-[1.35rem] border-2 border-indigo-50 bg-white p-3 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-100 hover:shadow-xl sm:min-h-[11rem] sm:rounded-[1.75rem] sm:p-4"><div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />{badge && <span className="absolute right-2 top-2 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700">{badge}</span>}<img src={imageSrc} alt="" aria-hidden="true" className="h-12 w-12 object-contain transition group-hover:scale-110 sm:h-16 sm:w-16" draggable={false} /><div className="mt-2 text-base font-black text-indigo-950 sm:text-xl">{title}</div><div className="mt-0.5 text-xs font-black text-indigo-600 sm:text-sm">{subtitle}</div><p className="mt-1.5 hidden flex-1 text-xs font-bold leading-relaxed text-gray-500 sm:block">{description}</p><span className="mt-3 inline-flex w-max rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-black text-white transition group-hover:bg-indigo-700 sm:px-4 sm:text-sm">Играть</span></button>;
const Stat = ({ label, value }: { label: string; value: string | number }) => <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-indigo-700"><div className="text-lg font-black leading-none sm:text-xl">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-widest opacity-70">{label}</div></div>;

export const PracticeHomeScreenWithLetterSquare: React.FC<Props> = ({ userProfile, dailyQuest, hasActiveClassicGame, hasActiveAnagramGame, activeDictionaryName, activeDictionaryWordCount, onStartDailyQuest, onStartClassic, onStartAnagrams, onStartTranslation, onStartSprint, onStartHangman, onStartMemory, onStartLetterSquare, onOpenProfile, onOpenDictionaryStudio }) => {
  const reviewEntries = Object.entries(userProfile.stats.wordsToReview || {}).sort(([, a], [, b]) => b - a);
  const daysInRow = userProfile.pet.dailyStreak || 0;
  const questCompleted = dailyQuest?.completed === true;
  const dictionaryName = activeDictionaryName || (userProfile.customDictionaryEn.length ? 'Мой словарь' : 'General English');
  const dictionaryWordCount = activeDictionaryWordCount ?? userProfile.customDictionaryEn.length;
  const dailyQuestModes = new Set(getDailyQuestTargetModes(!questCompleted ? dailyQuest : null));
  const questBadge = (mode: Parameters<typeof dailyQuestModes.has>[0], fallback?: string) => dailyQuestModes.has(mode) ? 'задание дня' : fallback;
  const cards: Card[] = [
    { title: 'Классика', subtitle: 'угадать слово', description: 'Угадайте слово за 6 попыток.', imageSrc: '/assets/games/game_classic.webp', badge: questBadge('game', hasActiveClassicGame ? 'продолжить' : undefined), accent: 'bg-indigo-500', onStart: onStartClassic },
    { title: 'Анаграммы', subtitle: 'собрать слово', description: 'Тренирует написание и форму слова.', imageSrc: '/assets/games/game_anagrams.webp', badge: questBadge('anagrams', hasActiveAnagramGame ? 'сохранено' : undefined), accent: 'bg-purple-500', onStart: onStartAnagrams },
    { title: 'Квадрат слов', subtitle: 'соседние буквы', description: 'Собирайте слово из квадрата. Только вверх, вниз, влево и вправо.', imageSrc: '/assets/games/line_game.webp', badge: 'новая', accent: 'bg-blue-500', onStart: onStartLetterSquare },
    { title: '1 из 2', subtitle: 'выбор перевода', description: 'Выберите правильный английский вариант.', imageSrc: '/assets/games/game_one_of_two.webp', badge: 'новая', accent: 'bg-pink-500', onStart: onStartTranslation },
    { title: 'Спринт', subtitle: 'на скорость', description: 'Короткая тренировка на скорость.', imageSrc: '/assets/games/game_sprint.webp', badge: questBadge('sprint', 'быстро'), accent: 'bg-green-500', onStart: onStartSprint },
    { title: 'Виселица', subtitle: 'по буквам', description: 'Вспоминайте слово постепенно.', imageSrc: '/assets/games/game_hangman.webp', badge: questBadge('hangman', 'без спешки'), accent: 'bg-amber-500', onStart: onStartHangman },
    { title: 'Память', subtitle: 'пары', description: 'Закрепляйте пары слово–перевод.', imageSrc: '/assets/games/game_memory.webp', badge: questBadge('memory', 'повторение'), accent: 'bg-cyan-500', onStart: onStartMemory },
  ];
  const runDailyQuest = () => dailyQuest && onStartDailyQuest ? onStartDailyQuest(dailyQuest) : onStartClassic();
  return <ScreenContainer className="max-w-7xl pb-20 pt-5"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-center"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">AnnWord Practice</div><h1 className="mt-2 text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">{questCompleted ? 'Практика на сегодня выполнена' : 'Ежедневная практика'}</h1><p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-gray-600 sm:text-base">{questCompleted ? 'Дни подряд продлены. Можно сыграть ещё или вернуться завтра.' : dailyQuest?.description || 'Сыграйте одну короткую тренировку, чтобы продлить дни подряд.'}</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={questCompleted ? onStartClassic : runDailyQuest} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:bg-indigo-700">{questCompleted ? 'Сыграть ещё' : 'Начать ежедневную тренировку'}</button><button type="button" onClick={onOpenDictionaryStudio} className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700">Словарь</button><button type="button" onClick={onOpenProfile} className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700">Статистика</button></div></div><div className="grid grid-cols-3 gap-2"><Stat label="Сегодня" value={questCompleted ? 'выполнено' : '0 / 1 игра'} /><Stat label="Дни подряд" value={`${daysInRow} д.`} /><Stat label="К повторению" value={reviewEntries.length} /></div></div></section><section className="mt-6 grid gap-6 xl:grid-cols-[1fr_24rem]"><div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Игры</div><h2 className="mt-1 text-2xl font-black text-indigo-950">Выберите режим</h2></div><div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{cards.map(card => <CardTile key={card.title} {...card} />)}</div></div><aside className="space-y-4"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Активный словарь</div><h2 className="mt-2 text-2xl font-black text-indigo-950">{dictionaryName}</h2><p className="mt-2 text-sm font-bold text-gray-500">{dictionaryWordCount} слов доступно</p><button type="button" onClick={onOpenDictionaryStudio} className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">Сменить словарь</button></section><section className="rounded-[2rem] border-2 border-purple-100 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-purple-500">Слова к повторению</div><h2 className="mt-2 text-2xl font-black text-indigo-950">{reviewEntries.length ? `${reviewEntries.length} слов` : 'Пока пусто'}</h2>{reviewEntries.length ? <div className="mt-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">{reviewEntries.slice(0, 12).map(([word, priority]) => <span key={word} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">{word} · {priority}</span>)}</div> : <p className="mt-2 text-sm font-bold leading-relaxed text-gray-500">Ошибочные слова появятся здесь после игр.</p>}</section><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Статистика</div><div className="mt-4 grid gap-3"><Stat label="Игр всего" value={userProfile.stats.gamesPlayed} /><Stat label="Успешных" value={userProfile.stats.gamesWon} /><Stat label="Словарь" value={dictionaryWordCount} /></div></section></aside></section></ScreenContainer>;
};
