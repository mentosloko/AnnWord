import React, { useEffect, useState } from 'react';
import { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../../types';
import { getCharacterXpProgress, normalizeMoodScore } from '../../services/gamificationRules';
import { getMoodDisplay } from '../../services/moodDisplay';
import { getPetCharacterAssetUrl } from '../../services/petAssets';
import { hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { CoinIcon } from '../CoinIcon';
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
  onStartClassic: () => void;
  onStartAnagrams: () => void;
  onStartTranslation: () => void;
  onStartSprint: () => void;
  onStartHangman: () => void;
  onStartMemory: () => void;
  onStartLetterSquare: () => void;
  onOpenShop: () => void;
  onOpenProfile?: () => void;
  onOpenPetRoom?: () => void;
  onOpenAdultRoom?: () => void;
  onOpenPremium?: () => void;
};

type Game = { title: string; image: string; note: string; action: () => void; badge?: string };
const dayWord = (days: number) => { const mod100 = days % 100, mod10 = days % 10; return mod100 >= 11 && mod100 <= 14 ? 'дней' : mod10 === 1 ? 'день' : mod10 >= 2 && mod10 <= 4 ? 'дня' : 'дней'; };
const GameTile: React.FC<Game> = ({ title, image, note, action, badge }) => <button type="button" onClick={action} className="relative flex min-h-[8.5rem] flex-col rounded-2xl bg-indigo-50/60 p-3 text-left transition hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 sm:min-h-[10rem] sm:p-4">{badge && <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 shadow-sm">{badge}</span>}<img src={image} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-12 w-12 object-contain sm:h-16 sm:w-16" draggable={false} /><div className="mt-2 text-lg font-bold text-indigo-950">{title}</div><div className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{note}</div></button>;

export const KidsHomeScreen: React.FC<Props> = ({ userProfile, dailyQuest, onStartDailyQuest, hasActiveClassicGame, hasActiveAnagramGame, onStartClassic, onStartAnagrams, onStartTranslation, onStartSprint, onStartHangman, onStartMemory, onStartLetterSquare, onOpenShop, onOpenProfile, onOpenPetRoom, onOpenAdultRoom, onOpenPremium }) => {
  const petUrl = getPetCharacterAssetUrl(userProfile.pet);
  const [petReady, setPetReady] = useState(false);
  useEffect(() => setPetReady(false), [petUrl]);
  const mood = getMoodDisplay(normalizeMoodScore(userProfile.pet));
  const streak = dailyQuest?.completed ? Math.max(1, Math.round(userProfile.pet.dailyStreak || 0)) : Math.max(0, Math.round(userProfile.pet.dailyStreak || 0));
  const xp = getCharacterXpProgress(userProfile.pet);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const continueAction = hasActiveClassicGame ? onStartClassic : hasActiveAnagramGame ? onStartAnagrams : null;
  const startQuest = () => dailyQuest && onStartDailyQuest ? onStartDailyQuest(dailyQuest) : onStartClassic();
  const games: Game[] = [
    { title: 'Классика', image: '/assets/games/game_classic.webp', note: 'Угадайте слово за шесть попыток.', action: onStartClassic, badge: hasActiveClassicGame ? 'Продолжить' : undefined },
    { title: 'Анаграммы', image: '/assets/games/game_anagrams.webp', note: 'Соберите слово из букв.', action: onStartAnagrams, badge: hasActiveAnagramGame ? 'Продолжить' : undefined },
    { title: '1 из 2', image: '/assets/games/game_one_of_two.webp', note: 'Выберите правильный перевод.', action: onStartTranslation },
    { title: 'Спринт', image: '/assets/games/game_sprint.webp', note: 'Отвечайте быстро и собирайте звёзды.', action: onStartSprint },
    { title: 'Виселица', image: '/assets/games/game_hangman.webp', note: 'Открывайте слово по буквам.', action: onStartHangman },
    { title: 'Память', image: '/assets/games/game_memory.webp', note: 'Найдите пары слово–перевод.', action: onStartMemory },
    { title: 'Змейка', image: '/assets/games/line_game.webp', note: 'Соединяйте соседние буквы.', action: onStartLetterSquare },
  ];

  return <ScreenContainer className="max-w-6xl pb-24 pt-4 sm:pb-20 sm:pt-6">
    <section className="grid overflow-hidden rounded-[2rem] bg-gradient-to-br from-purple-700 to-indigo-700 text-white shadow-xl lg:grid-cols-[1fr_21rem]">
      <div className="p-5 sm:p-8"><div className="text-xs font-bold uppercase tracking-wider text-white/65">Задание на сегодня</div><h1 className="mt-2 text-3xl font-bold leading-tight sm:text-5xl">{dailyQuest?.completed ? `Серия: ${streak} ${dayWord(streak)}` : dailyQuest?.title || 'Поиграем со словами?'}</h1><p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/80 sm:text-base">{dailyQuest?.completed ? 'Задание выполнено. Питомец получил награду, а теперь можно выбрать любую игру.' : dailyQuest?.description || 'Короткая игра поможет продлить серию и порадовать питомца.'}</p><div className="mt-6 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={dailyQuest?.completed ? (continueAction || onStartClassic) : startQuest} className="rounded-2xl bg-white px-6 py-3.5 font-bold text-indigo-700 shadow-sm">{dailyQuest?.completed ? continueAction ? 'Продолжить игру' : 'Играть ещё' : 'Начать задание'}</button>{!dailyQuest?.completed && continueAction && <button type="button" onClick={continueAction} className="rounded-2xl bg-white/10 px-6 py-3.5 font-bold text-white ring-1 ring-white/25">Продолжить сохранённую</button>}</div></div>
      <button type="button" onClick={onOpenPetRoom} className="relative hidden min-h-[17rem] items-end justify-center overflow-hidden bg-white/10 lg:flex"><span className="sr-only">Открыть комнату питомца</span>{!petReady && <div className="absolute inset-6 animate-pulse rounded-[2rem] bg-white/10" />}{petUrl && <img src={petUrl} alt="" onLoad={() => setPetReady(true)} className={`h-72 w-72 object-cover object-center transition-opacity ${petReady ? 'opacity-100' : 'opacity-0'}`} draggable={false} />}</button>
    </section>

    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <SectionCard><div className={experienceUi.eyebrow}>Другие игры</div><h2 className={`mt-1 ${experienceUi.sectionTitle}`}>Выберите игру</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{games.map(game => <GameTile key={game.title} {...game} />)}</div></SectionCard>
      <aside className="space-y-4"><SectionCard><div className="flex items-center justify-between gap-3"><div><div className={experienceUi.eyebrow}>Питомец</div><h2 className="mt-1 text-xl font-bold text-indigo-950">{userProfile.pet.name}</h2></div><button type="button" onClick={onOpenPetRoom} className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-bold text-purple-700">Комната</button></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-yellow-50 p-3"><CoinIcon className="text-xl" /><div className="mt-1 text-2xl font-bold text-yellow-700">{userProfile.coins}</div><div className="text-xs font-medium text-yellow-700/70">монет</div></div><div className="rounded-2xl bg-purple-50 p-3"><div className="text-sm font-bold text-purple-700">{mood.label}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-purple-100"><div className={`h-full ${mood.barClass}`} style={{ width: `${normalizeMoodScore(userProfile.pet)}%` }} /></div><div className="mt-2 text-xs font-medium text-purple-600">ур. {xp.level} · XP {xp.currentLevelXp}/{xp.xpForNextLevel}</div></div></div></SectionCard>
        <SectionCard><div className={experienceUi.eyebrow}>Быстрые действия</div><div className="mt-3 grid gap-2"><button type="button" onClick={onOpenShop} className={experienceUi.secondaryButton}>Магазин</button><button type="button" onClick={onOpenProfile} className={experienceUi.secondaryButton}>Прогресс ребёнка</button><button type="button" onClick={onOpenAdultRoom} className={experienceUi.secondaryButton}>Кабинет родителя</button></div></SectionCard>
        {!hasPremium && onOpenPremium && <button type="button" onClick={onOpenPremium} className="w-full rounded-3xl bg-amber-50 p-5 text-left ring-1 ring-amber-100"><div className="text-xs font-bold uppercase tracking-wider text-amber-600">Kids Premium</div><div className="mt-2 text-lg font-bold text-indigo-950">Школьные слова и отчёты</div><div className="mt-1 text-sm font-medium text-slate-600">Добавляйте свои подборки и подключайте преподавателя.</div></button>}
      </aside>
    </div>
  </ScreenContainer>;
};
