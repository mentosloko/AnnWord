import React from 'react';
import { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../../types';
import { getDailyQuestTargetModes } from '../../services/dailyQuest';
import { hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { StreakBadge } from '../StreakBadge';
import { ScreenContainer } from '../layout/ScreenContainer';
import { SectionCard, experienceUi } from '../ui/ExperiencePrimitives';

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

type GameCard = { title: string; note: string; image: string; badge?: string; action: () => void };
const dayWord = (days: number) => { const mod100 = days % 100, mod10 = days % 10; return mod100 >= 11 && mod100 <= 14 ? 'дней' : mod10 === 1 ? 'день' : mod10 >= 2 && mod10 <= 4 ? 'дня' : 'дней'; };

const GameTile: React.FC<GameCard> = ({ title, note, image, badge, action }) => <button type="button" onClick={action} className="group relative flex min-h-[8.5rem] flex-col rounded-2xl bg-indigo-50/55 p-3 text-left transition hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 sm:min-h-[10rem] sm:p-4">
  {badge && <span className="absolute right-2 top-2 max-w-[7.5rem] truncate rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 shadow-sm">{badge}</span>}
  <img src={image} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-12 w-12 object-contain transition group-hover:scale-105 sm:h-16 sm:w-16" draggable={false} />
  <div className="mt-2 text-lg font-bold text-indigo-950">{title}</div><div className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{note}</div>
</button>;

export const PracticeHomeScreenWithLetterSquare: React.FC<Props> = ({ userProfile, dailyQuest, hasActiveClassicGame, hasActiveAnagramGame, activeDictionaryName, onStartDailyQuest, onStartClassic, onStartAnagrams, onStartTranslation, onStartSprint, onStartHangman, onStartMemory, onStartLetterSquare, onOpenProfile, onOpenDictionaryStudio, onOpenPremium }) => {
  const questCompleted = dailyQuest?.completed === true;
  const storedStreak = Math.max(0, Math.round(userProfile.pet.dailyStreak || 0));
  const streak = questCompleted ? Math.max(1, storedStreak) : storedStreak;
  const dictionaryName = activeDictionaryName || (userProfile.customDictionaryEn.length ? 'Слова из вашего списка' : 'General English');
  const questModes = new Set(getDailyQuestTargetModes(!questCompleted ? dailyQuest : null));
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const continueAction = hasActiveClassicGame ? onStartClassic : hasActiveAnagramGame ? onStartAnagrams : null;
  const runQuest = () => dailyQuest && onStartDailyQuest ? onStartDailyQuest(dailyQuest) : onStartClassic();
  const badge = (mode: Parameters<typeof questModes.has>[0], fallback?: string) => questModes.has(mode) ? 'Задание дня' : fallback;
  const games: GameCard[] = [
    { title: 'Классика', note: 'Угадайте слово за шесть попыток.', image: '/assets/games/game_classic.webp', badge: badge('game', hasActiveClassicGame ? 'Есть сохранение' : undefined), action: onStartClassic },
    { title: 'Анаграммы', note: 'Соберите слово из перемешанных букв.', image: '/assets/games/game_anagrams.webp', badge: badge('anagrams', hasActiveAnagramGame ? 'Есть сохранение' : undefined), action: onStartAnagrams },
    { title: '1 из 2', note: 'Выберите правильный английский вариант.', image: '/assets/games/game_one_of_two.webp', action: onStartTranslation },
    { title: 'Спринт', note: 'Быстрые ответы в течение минуты.', image: '/assets/games/game_sprint.webp', badge: badge('sprint'), action: onStartSprint },
    { title: 'Виселица', note: 'Вспоминайте слово по одной букве.', image: '/assets/games/game_hangman.webp', badge: badge('hangman'), action: onStartHangman },
    { title: 'Память', note: 'Найдите пары «слово — перевод».', image: '/assets/games/game_memory.webp', badge: badge('memory'), action: onStartMemory },
    { title: 'Змейка', note: 'Соберите слово цепочкой соседних букв.', image: '/assets/games/line_game.webp', action: onStartLetterSquare },
  ];

  return <ScreenContainer className="max-w-6xl pb-24 pt-4 sm:pb-20 sm:pt-6">
    <section className="grid overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 to-purple-700 text-white shadow-xl lg:grid-cols-[1fr_22rem]">
      <div className="p-5 sm:p-8"><div className="text-xs font-bold uppercase tracking-wider text-white/65">Следующее действие</div><div className="mt-3 flex items-start justify-between gap-3"><h1 className="text-3xl font-bold leading-tight sm:text-5xl">{questCompleted ? `Серия: ${streak} ${dayWord(streak)}` : dailyQuest?.title || 'Ежедневная практика'}</h1>{questCompleted && <StreakBadge days={streak} />}</div><p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/80 sm:text-base">{questCompleted ? 'Главное задание выполнено. Можно закрепить сложные слова в любом режиме.' : dailyQuest?.description || 'Одна короткая тренировка продлит серию и обновит список повторения.'}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={questCompleted ? (continueAction || onStartClassic) : runQuest} className="rounded-2xl bg-white px-6 py-3.5 font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50">{questCompleted ? continueAction ? 'Продолжить игру' : 'Сыграть ещё' : 'Начать задание'}</button>{!questCompleted && continueAction && <button type="button" onClick={continueAction} className="rounded-2xl bg-white/10 px-6 py-3.5 font-bold text-white ring-1 ring-white/25 hover:bg-white/15">Продолжить сохранённую</button>}</div>
      </div>
      <div className="hidden items-end justify-center overflow-hidden lg:flex" aria-hidden="true"><img src="/assets/practice-mascot.webp" alt="" className="h-72 w-full object-contain object-bottom" draggable={false} /></div>
    </section>

    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <SectionCard><div className="flex items-end justify-between gap-3"><div><div className={experienceUi.eyebrow}>Другие игры</div><h2 className={`mt-1 ${experienceUi.sectionTitle}`}>Выберите способ повторения</h2></div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{games.map(game => <GameTile key={game.title} {...game} />)}</div></SectionCard>
      <aside className="space-y-4"><SectionCard><div className={experienceUi.eyebrow}>Активный словарь</div><h2 className="mt-2 text-xl font-bold text-indigo-950">{dictionaryName}</h2><p className="mt-2 text-sm font-medium text-slate-500">Игры запускаются сразу с последними выбранными настройками.</p><button type="button" onClick={onOpenDictionaryStudio} className={`mt-4 w-full ${experienceUi.secondaryButton}`}>Изменить слова</button></SectionCard>
        <SectionCard><div className={experienceUi.eyebrow}>Прогресс</div><p className="mt-2 text-sm font-medium text-slate-600">Посмотрите слова, которые требуют повторения, и результаты тренировок.</p><button type="button" onClick={onOpenProfile} className={`mt-4 w-full ${experienceUi.secondaryButton}`}>Открыть прогресс</button></SectionCard>
        {!hasPremium && onOpenPremium && <button type="button" onClick={onOpenPremium} className="w-full rounded-3xl bg-amber-50 p-5 text-left ring-1 ring-amber-100 transition hover:bg-amber-100/70"><div className="text-xs font-bold uppercase tracking-wider text-amber-600">Premium</div><div className="mt-2 text-lg font-bold text-indigo-950">Свои темы и списки</div><div className="mt-1 text-sm font-medium text-slate-600">Подключайте слова для работы, учёбы или поездки.</div></button>}
      </aside>
    </div>
  </ScreenContainer>;
};
