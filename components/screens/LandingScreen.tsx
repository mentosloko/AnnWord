import React from 'react';
import { UserProfile } from '../../types';
import { getCharacterProgressPercent, getCharacterStageLabel, normalizeMoodScore } from '../../services/gamificationRules';
import { getPetEmoji } from '../../services/petEngine';
import { getPuppyCharacterAssetUrl } from '../../services/petAssets';
import { ScreenContainer } from '../layout/ScreenContainer';

interface LandingScreenProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
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

const GameCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-[7.25rem] flex-col rounded-2xl border-2 border-indigo-50 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl sm:min-h-0 sm:rounded-3xl sm:p-5"
  >
    <div className="mb-2 text-3xl transition-transform origin-left group-hover:scale-110 sm:mb-4 sm:text-4xl">{icon}</div>
    <h3 className="text-base font-black text-indigo-950 sm:mb-2 sm:text-xl">{title}</h3>
    <p className="mt-1 hidden text-sm leading-relaxed text-gray-500 sm:block">{description}</p>
  </button>
);

export const LandingScreen: React.FC<LandingScreenProps> = ({
  userProfile,
  isAuthenticated,
  onStartClassic,
  onStartAnagrams,
  onStartSprint,
  onStartHangman,
  onStartMemory,
  onOpenShop,
  onOpenLogin,
  onOpenProfile,
  onOpenPetRoom,
}) => {
  const xpProgress = getCharacterProgressPercent(userProfile.pet);
  const moodScore = normalizeMoodScore(userProfile.pet);
  const characterAssetUrl = getPuppyCharacterAssetUrl(userProfile.pet);

  return (
    <ScreenContainer className="pb-24">
      <section className="grid grid-cols-1 items-center gap-5 py-4 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div>
          {isAuthenticated ? (
            <>
              <div className="mb-3 text-sm font-black uppercase tracking-widest text-indigo-400">С возвращением, {userProfile.username}</div>
              <h1 className="mb-4 text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">
                Во что сыграем сегодня?
              </h1>
              <p className="mb-6 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
                Играйте, собирайте монеты и развивайте {userProfile.pet.name}.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onStartClassic} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">
                  Играть в классику
                </button>
                <button type="button" onClick={onOpenPetRoom} className="rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3.5 font-black text-indigo-700 transition hover:bg-indigo-50">
                  К питомцу
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600">
                Игра для английских слов
              </div>
              <h1 className="mb-4 text-4xl font-black leading-tight text-indigo-950 sm:text-6xl">
                Учите английские слова через игру
              </h1>
              <p className="mb-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
                Играйте сразу без регистрации. Аккаунт понадобится, чтобы сохранить прогресс, питомца, покупки и свой словарь.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onStartClassic} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">Играть</button>
                <button type="button" onClick={onOpenLogin} className="rounded-2xl bg-gray-950 px-6 py-4 font-black text-white transition hover:bg-gray-800">Сохранить прогресс</button>
              </div>
            </>
          )}
        </div>

        <aside className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 text-sm font-bold uppercase tracking-widest text-white/70">{isAuthenticated ? 'Ваш питомец' : 'Без аккаунта'}</div>
              <div className="text-2xl font-black">{isAuthenticated ? userProfile.pet.name : 'Попробуйте игру'}</div>
            </div>
            <button type="button" onClick={isAuthenticated ? onOpenProfile : onOpenLogin} className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black transition hover:bg-white/25">
              {isAuthenticated ? 'Профиль' : 'Войти'}
            </button>
          </div>

          {!isAuthenticated ? (
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <div className="mb-3 text-5xl">{getPetEmoji(userProfile.pet)}</div>
              <h2 className="mb-2 text-xl font-black">Сохраните своего питомца</h2>
              <p className="mb-4 text-sm leading-relaxed text-white/75">
                После входа будут сохраняться монеты, покупки, опыт и личный словарь.
              </p>
              <button type="button" onClick={onOpenLogin} className="w-full rounded-2xl bg-white py-3 font-black text-indigo-700 transition hover:bg-indigo-50">Создать аккаунт</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={onOpenShop} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-left transition hover:bg-white/15">
                  <div className="mb-2 text-3xl">🪙</div><div className="text-2xl font-black">{userProfile.coins}</div><div className="text-xs font-bold uppercase tracking-widest text-white/65">монет</div>
                </button>
                <button type="button" onClick={onOpenPetRoom} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4 text-left transition hover:bg-white/15" title="Открыть комнату питомца">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 ring-1 ring-white/50 shadow-sm">
                      {characterAssetUrl ? <img src={characterAssetUrl} alt={userProfile.pet.name} className="h-[4.25rem] w-[4.25rem] scale-125 object-cover transition-transform group-hover:scale-[1.33]" draggable={false} /> : <div className="text-4xl">{getPetEmoji(userProfile.pet)}</div>}
                    </div>
                    <div className="min-w-0"><div className="text-[11px] font-black uppercase tracking-widest text-white/60">Комната</div><div className="truncate text-lg font-black leading-tight">{userProfile.pet.name}</div></div>
                  </div>
                  <div className="flex items-end justify-between gap-2"><div><div className="text-2xl font-black leading-none">{userProfile.pet.level}</div><div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/65">уровень</div></div><span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black text-white/80 transition group-hover:bg-white/25">Открыть</span></div>
                </button>
              </div>
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-4">
                <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-widest text-white/65"><span>Опыт</span><span>{userProfile.pet.xp}</span></div>
                <div className="mb-3 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-white" style={{ width: `${xpProgress}%` }} /></div>
                <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-widest text-white/65"><span>Настроение</span><span>{moodScore}/100</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-white/80" style={{ width: `${moodScore}%` }} /></div>
                <div className="mt-3 text-xs font-bold text-white/70">{getCharacterStageLabel(userProfile.pet.stage)}</div>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        <GameCard title="Классика" description="Угадайте слово." icon="🧩" onClick={onStartClassic} />
        <GameCard title="Анаграммы" description="Соберите слово." icon="🔀" onClick={onStartAnagrams} />
        <GameCard title="Спринт" description="Выбирайте быстро." icon="⚡" onClick={onStartSprint} />
        <GameCard title="Виселица" description="Угадайте буквы." icon="🎯" onClick={onStartHangman} />
        <GameCard title="Память" description="Найдите пары." icon="🧠" onClick={onStartMemory} />
      </section>
    </ScreenContainer>
  );
};
