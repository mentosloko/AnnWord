import React from 'react';
import { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../../types';
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
  onStartSprint: () => void;
  onStartHangman: () => void;
  onStartMemory: () => void;
  onOpenProfile?: () => void;
  onOpenDictionaryStudio?: () => void;
};

type GameCard = {
  title: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  badge?: string;
  accent: string;
  onStart: () => void;
};

const PRACTICE_IMAGE = '/assets/onboarding/account-mode-player.webp';
const T = {
  title: 'AnnWord Practice',
  today: 'Сегодняшняя тренировка',
  completedToday: 'Сегодняшняя практика выполнена',
  dailyPractice: 'Ежедневная практика',
  keepStreak: 'Сыграйте 1 короткую игру и сохраните streak.',
  comeBackTomorrow: 'Streak продлён. Возвращайтесь завтра за новым заданием.',
  startTraining: 'Начать тренировку',
  playMore: 'Сыграть ещё',
  chooseGame: 'Выберите игру',
  dictionary: 'Активный словарь',
  changeDictionary: 'Сменить словарь',
  myDictionary: 'Мой словарь',
  stats: 'Мини-статистика',
  todayProgress: 'Сегодня',
  streak: 'Streak',
  review: 'К повторению',
  gamesPlayed: 'Игр всего',
  profile: 'Статистика',
  wordsAvailable: 'слов доступно',
  premiumHint: 'Premium-темы: Business · Travel · Medicine',
  done: 'выполнено',
  notDone: '0 / 1 игра',
};

const StatPill = ({ label, value, tone = 'indigo' }: { label: string; value: string | number; tone?: 'indigo' | 'purple' | 'green' | 'amber' }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}><div className="text-xl font-black leading-none">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-widest opacity-70">{label}</div></div>;
};

const GameTile: React.FC<GameCard> = ({ title, subtitle, description, imageSrc, badge, accent, onStart }) => <button type="button" onClick={onStart} className="group relative flex min-h-[13rem] flex-col overflow-hidden rounded-[1.75rem] border-2 border-indigo-50 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-100 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-100"><div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />{badge && <span className="absolute right-3 top-3 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">{badge}</span>}<img src={imageSrc} alt="" aria-hidden="true" className="h-16 w-16 object-contain transition group-hover:scale-110" draggable={false} /><div className="mt-3 text-xl font-black text-indigo-950">{title}</div><div className="mt-1 text-sm font-black text-indigo-600">{subtitle}</div><p className="mt-2 flex-1 text-xs font-bold leading-relaxed text-gray-500">{description}</p><span className="mt-4 inline-flex w-max rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white transition group-hover:bg-indigo-700">Играть</span></button>;

export const PracticeHomeScreen: React.FC<Props> = ({ userProfile, dailyQuest, hasActiveClassicGame, hasActiveAnagramGame, activeDictionaryName, activeDictionaryWordCount, onStartDailyQuest, onStartClassic, onStartAnagrams, onStartSprint, onStartHangman, onStartMemory, onOpenProfile, onOpenDictionaryStudio }) => {
  const wordsToReview = Object.keys(userProfile.stats.wordsToReview || {}).length;
  const streak = userProfile.pet.dailyStreak || 0;
  const dictionaryName = activeDictionaryName || (userProfile.customDictionaryEn.length ? T.myDictionary : 'General English');
  const dictionaryWordCount = activeDictionaryWordCount ?? userProfile.customDictionaryEn.length;
  const questCompleted = dailyQuest?.completed === true;
  const runDailyQuest = () => dailyQuest && onStartDailyQuest ? onStartDailyQuest(dailyQuest) : onStartClassic();
  const cards: GameCard[] = [
    { title: 'Классика', subtitle: 'Спокойно угадать слово', description: 'Угадайте слово за 6 попыток. Лучший режим для ежедневной тренировки.', imageSrc: '/assets/games/game_classic.webp', badge: dailyQuest && !questCompleted ? 'задание дня' : hasActiveClassicGame ? 'продолжить' : undefined, accent: 'bg-indigo-500', onStart: onStartClassic },
    { title: 'Анаграммы', subtitle: 'Собрать слово из букв', description: 'Тренирует написание и помогает лучше запоминать форму слова.', imageSrc: '/assets/games/game_anagrams.webp', badge: hasActiveAnagramGame ? 'save' : undefined, accent: 'bg-purple-500', onStart: onStartAnagrams },
    { title: 'Спринт', subtitle: 'Быстро проверить себя', description: 'Короткая тренировка на скорость: удобно закрыть практику за 1–2 минуты.', imageSrc: '/assets/games/game_sprint.webp', badge: 'быстро', accent: 'bg-green-500', onStart: onStartSprint },
    { title: 'Виселица', subtitle: 'Открыть слово по буквам', description: 'Спокойный режим без спешки: вспоминайте слово постепенно.', imageSrc: '/assets/games/game_hangman.webp', badge: 'без спешки', accent: 'bg-amber-500', onStart: onStartHangman },
    { title: 'Память', subtitle: 'Связать слово и перевод', description: 'Закрепляйте новые слова через пары и повторение.', imageSrc: '/assets/games/game_memory.webp', badge: 'повторение', accent: 'bg-cyan-500', onStart: onStartMemory },
    { title: 'Повторить ошибки', subtitle: `${wordsToReview} слов к повторению`, description: wordsToReview ? 'Запустите тренировку по словам, которые чаще вызывали ошибки.' : 'Ошибок пока нет. Начните игру, и AnnWord соберёт слова для повторения.', imageSrc: PRACTICE_IMAGE, badge: wordsToReview ? 'рекомендуем' : 'скоро', accent: 'bg-rose-500', onStart: onStartClassic },
  ];

  return <ScreenContainer className="max-w-7xl pb-20 pt-6"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{T.title}</div><h1 className="mt-2 text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">{questCompleted ? T.completedToday : T.today}</h1><p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-gray-600 sm:text-base">{questCompleted ? T.comeBackTomorrow : dailyQuest?.description || T.keepStreak}</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={questCompleted ? onStartClassic : runDailyQuest} className="rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white shadow-sm transition hover:bg-indigo-700">{questCompleted ? T.playMore : T.startTraining}</button><button type="button" onClick={onOpenDictionaryStudio} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-3 font-black text-indigo-700 transition hover:bg-indigo-50">{T.changeDictionary}</button><button type="button" onClick={onOpenProfile} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-3 font-black text-indigo-700 transition hover:bg-indigo-50">{T.profile}</button></div></div><div className="grid grid-cols-3 gap-2 sm:min-w-[26rem]"><StatPill label={T.todayProgress} value={questCompleted ? T.done : T.notDone} tone={questCompleted ? 'green' : 'indigo'} /><StatPill label={T.streak} value={`${streak} д.`} tone="amber" /><StatPill label={T.review} value={wordsToReview} tone="purple" /></div></div></section><section className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]"><div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{T.dailyPractice}</div><h2 className="mt-1 text-2xl font-black text-indigo-950">{T.chooseGame}</h2></div>{dailyQuest && <span className={`rounded-full px-3 py-1 text-xs font-black ${questCompleted ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{questCompleted ? 'streak продлён' : 'задание активно'}</span>}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <GameTile key={card.title} {...card} />)}</div></div><aside className="space-y-4"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{T.dictionary}</div><h2 className="mt-2 text-2xl font-black text-indigo-950">{dictionaryName}</h2><p className="mt-2 text-sm font-bold text-gray-500">{dictionaryWordCount} {T.wordsAvailable}</p><button type="button" onClick={onOpenDictionaryStudio} className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white transition hover:bg-indigo-700">{T.changeDictionary}</button><div className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-xs font-bold leading-relaxed text-indigo-700">{T.premiumHint}</div></section><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{T.stats}</div><div className="mt-4 grid gap-3"><StatPill label={T.gamesPlayed} value={userProfile.stats.gamesPlayed} /><StatPill label="Успешных" value={userProfile.stats.gamesWon} tone="green" /><StatPill label="Словарь" value={dictionaryWordCount} tone="purple" /></div></section></aside></section></ScreenContainer>;
};
