import React from 'react';
import { DailyQuestCompletionReward, DailyQuestState, UserProfile } from '../../types';
import { getCharacterProgressPercent, getCharacterStageLabel, normalizeMoodScore } from '../../services/gamificationRules';
import { getMoodDisplay } from '../../services/moodDisplay';
import { getPetEmoji } from '../../services/petEngine';
import { getPuppyCharacterAssetUrl } from '../../services/petAssets';
import { CoinIcon } from '../CoinIcon';
import { DailyQuestCard, DailyQuestRewardModal } from '../DailyQuestCard';
import { ScreenContainer } from '../layout/ScreenContainer';

interface LandingScreenProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  dailyQuest?: DailyQuestState | null;
  dailyQuestReward?: DailyQuestCompletionReward | null;
  onCloseDailyQuestReward?: () => void;
  onStartDailyQuest?: (quest: DailyQuestState) => void;
  hasActiveClassicGame?: boolean;
  hasActiveAnagramGame?: boolean;
  onStartClassic: () => void;
  onStartAnagrams: () => void;
  onStartSprint: () => void;
  onStartHangman: () => void;
  onStartMemory: () => void;
  onOpenShop: () => void;
  onOpenRules: () => void;
  onOpenLogin: () => void;
  onOpenProfile?: () => void;
  onOpenPetRoom?: () => void;
}

interface GameOption {
  title: string;
  iconSrc: string;
  onStart: () => void;
  badge?: string;
}

const GameIconButton: React.FC<GameOption> = ({ title, iconSrc, onStart, badge }) => (
  <button
    type="button"
    aria-label={title}
    onClick={onStart}
    className="group relative flex min-w-0 flex-col items-center rounded-2xl border-2 border-indigo-50 bg-white px-1.5 py-2.5 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl sm:px-2 sm:py-3"
  >
    {badge && <span aria-hidden="true" className="absolute -right-1 -top-2 rounded-full bg-green-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-green-700 sm:right-1 sm:top-1 sm:text-[9px]">{badge}</span>}
    <img src={iconSrc} alt="" aria-hidden="true" className="h-12 w-12 object-contain transition-transform group-hover:scale-110 sm:h-16 sm:w-16 lg:h-20 lg:w-20" draggable={false} />
    <span aria-hidden="true" className="mt-1 block max-w-full truncate text-[11px] font-black text-indigo-950 sm:mt-2 sm:text-sm lg:text-base">{title}</span>
  </button>
);

export const LandingScreen: React.FC<LandingScreenProps> = ({
  userProfile, isAuthenticated, dailyQuest, dailyQuestReward, onCloseDailyQuestReward, onStartDailyQuest,
  hasActiveClassicGame = false, hasActiveAnagramGame = false, onStartClassic, onStartAnagrams, onStartSprint,
  onStartHangman, onStartMemory, onOpenShop, onOpenLogin, onOpenProfile, onOpenPetRoom,
}) => {
  const xpProgress = getCharacterProgressPercent(userProfile.pet);
  const moodScore = normalizeMoodScore(userProfile.pet);
  const moodDisplay = getMoodDisplay(moodScore);
  const characterAssetUrl = getPuppyCharacterAssetUrl(userProfile.pet);
  const gameOptions: GameOption[] = [
    { title: hasActiveClassicGame ? 'Продолжить' : 'Классика', iconSrc: '/assets/games/game_classic.webp', onStart: onStartClassic, badge: hasActiveClassicGame ? 'Сохранено' : undefined },
    { title: hasActiveAnagramGame ? 'Продолжить' : 'Анаграммы', iconSrc: '/assets/games/game_anagrams.webp', onStart: onStartAnagrams, badge: hasActiveAnagramGame ? 'Анаграммы' : undefined },
    { title: 'Спринт', iconSrc: '/assets/games/game_sprint.webp', onStart: onStartSprint },
    { title: 'Виселица', iconSrc: '/assets/games/game_hangman.webp', onStart: onStartHangman },
    { title: 'Память', iconSrc: '/assets/games/game_memory.webp', onStart: onStartMemory },
  ];

  return (
    <ScreenContainer className="pb-6 sm:pb-24">
      <section className="grid grid-cols-1 items-center gap-5 py-4 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div>
          {isAuthenticated ? <><h1 className="mb-4 text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">Во что сыграем сегодня?</h1><p className="mb-6 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">Играйте, собирайте ₽ и развивайте {userProfile.pet.name}.</p></> : <><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600">Игра для английских слов</div><h1 className="mb-4 text-4xl font-black leading-tight text-indigo-950 sm:text-6xl">Учите английские слова через игру</h1><p className="mb-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">Играйте сразу без регистрации. Аккаунт понадобится, чтобы сохранить прогресс, питомца, покупки и свой словарь.</p></>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">{gameOptions.map(game => <GameIconButton key={`${game.title}-${game.iconSrc}`} {...game} />)}</div>
          {isAuthenticated && dailyQuest && <DailyQuestCard quest={dailyQuest} onStart={onStartDailyQuest} />}
          {!isAuthenticated && <button type="button" onClick={onOpenLogin} className="mt-5 rounded-2xl bg-gray-950 px-6 py-4 font-black text-white transition hover:bg-gray-800">Сохранить прогресс</button>}
        </div>
        <aside className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4"><div><div className="text-sm font-bold uppercase tracking-widest text-white/70">{isAuthenticated ? 'Ваш питомец' : 'Без аккаунта'}</div>{!isAuthenticated && <div className="mt-1 text-2xl font-black">Попробуйте игру</div>}</div><button type="button" onClick={isAuthenticated ? onOpenProfile : onOpenLogin} className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black transition hover:bg-white/25">{isAuthenticated ? 'Профиль' : 'Войти'}</button></div>
          {!isAuthenticated && <div className="rounded-3xl border border-white/10 bg-white/10 p-5"><div className="mb-3 text-5xl">{getPetEmoji(userProfile.pet)}</div><h2 className="mb-2 text-xl font-black">Сохраните своего питомца</h2><p className="mb-4 text-sm leading-relaxed text-white/75">После входа будут сохраняться ₽, покупки, опыт и личный словарь.</p><button type="button" onClick={onOpenLogin} className="w-full rounded-2xl bg-white py-3 font-black text-indigo-700 transition hover:bg-indigo-50">Создать аккаунт</button></div>}
          {isAuthenticated && <><div className="grid grid-cols-2 gap-3"><button type="button" onClick={onOpenShop} className="flex min-h-[8.25rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/10 p-4 text-left transition hover:bg-white/15"><CoinIcon className="text-3xl" label="рубли" /><div><div className="text-2xl font-black">{userProfile.coins}</div><div className="text-xs font-bold uppercase tracking-widest text-white/65">рублей</div></div></button><div className="flex min-h-[8.25rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/10 p-3"><div className="flex items-end justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-white/65">Уровень</span><span className="text-xl font-black">{userProfile.pet.level}</span></div><div><div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/65"><span>Опыт</span><span>{userProfile.pet.xp}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-white" style={{ width: `${xpProgress}%` }} /></div></div><div><div className={`mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest ${moodDisplay.textOnDarkClass}`}><span>{moodDisplay.label}</span><span>{moodScore}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className={`h-full ${moodDisplay.barClass}`} style={{ width: `${moodScore}%` }} /></div></div></div></div><button type="button" onClick={onOpenPetRoom} className="group mt-3 flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-3 text-left transition hover:bg-white/15" title="Открыть комнату питомца"><div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 ring-1 ring-white/50 shadow-sm">{characterAssetUrl ? <img src={characterAssetUrl} alt={userProfile.pet.name} className="h-[6.5rem] w-[6.5rem] scale-125 object-cover transition-transform group-hover:scale-[1.33]" draggable={false} /> : <div className="text-5xl">{getPetEmoji(userProfile.pet)}</div>}</div><div className="min-w-0 flex-1"><div className="text-[11px] font-black uppercase tracking-widest text-white/60">Комната питомца</div><div className="mt-1 truncate text-2xl font-black leading-tight">{userProfile.pet.name}</div><div className="mt-2 text-sm font-bold text-white/70">{getCharacterStageLabel(userProfile.pet.stage)}</div></div><span aria-hidden="true" className="rounded-full bg-white/15 px-3 py-2 text-xl font-black text-white/80">›</span></button></>}
        </aside>
      </section>
      {dailyQuestReward && onCloseDailyQuestReward && <DailyQuestRewardModal reward={dailyQuestReward} onClose={onCloseDailyQuestReward} />}
    </ScreenContainer>
  );
};