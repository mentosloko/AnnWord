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

const GAME_MODES = [
  {
    title: 'Классика',
    subtitle: 'Wordle',
    description: 'Угадайте слово за несколько попыток.',
    icon: '🧩',
    accent: 'from-indigo-500 to-blue-500',
    badge: 'Основной режим',
  },
  {
    title: 'Анаграммы',
    subtitle: 'Собери слово',
    description: 'Составьте слово из перемешанных букв.',
    icon: '🔀',
    accent: 'from-purple-500 to-fuchsia-500',
  },
  {
    title: 'Спринт',
    subtitle: 'На скорость',
    description: 'Быстро выбирайте правильные переводы.',
    icon: '⚡',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    title: 'Виселица',
    subtitle: 'По буквам',
    description: 'Открывайте буквы и угадывайте слово.',
    icon: '🎯',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Память',
    subtitle: 'Мемо',
    description: 'Найдите пары слово–перевод.',
    icon: '🧠',
    accent: 'from-emerald-500 to-teal-500',
    wide: true,
  },
];

const GameModeCard: React.FC<{
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accent: string;
  badge?: string;
  wide?: boolean;
  onClick: () => void;
}> = ({ title, subtitle, description, icon, accent, badge, wide, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative overflow-hidden text-left rounded-[2rem] bg-white border-2 border-indigo-50 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all min-h-[168px] ${wide ? 'sm:col-span-2 xl:col-span-2' : ''}`}
    aria-label={`Играть: ${title}`}
  >
    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-3xl shadow-sm group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      {badge && (
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-indigo-600">
          {badge}
        </span>
      )}
    </div>
    <div className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-1">{subtitle}</div>
    <h3 className="text-2xl font-black text-indigo-950 mb-2">{title}</h3>
    <p className="text-sm text-gray-500 leading-relaxed max-w-sm">{description}</p>
    <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-indigo-600 opacity-80 group-hover:opacity-100">
      Открыть режим <span aria-hidden="true">→</span>
    </div>
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
  const gameHandlers = [onStartClassic, onStartAnagrams, onStartSprint, onStartHangman, onStartMemory];

  return (
    <ScreenContainer className="pb-16">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-6 lg:gap-8 py-5 sm:py-7 items-start">
        <main className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-7">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-2 text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">
                AnnWord · игровой хаб
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-indigo-950 leading-tight mb-2">
                Выберите игру
              </h1>
              <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-2xl">
                Все режимы доступны сразу: тренируйте словарь, получайте XP, монеты и развивайте персонажа.
              </p>
            </div>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-fit rounded-2xl bg-gray-950 px-5 py-3 text-white font-black hover:bg-gray-800 transition"
              >
                Зарегистрироваться
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {GAME_MODES.map((mode, index) => (
              <GameModeCard
                key={mode.title}
                title={mode.title}
                subtitle={mode.subtitle}
                description={mode.description}
                icon={mode.icon}
                accent={mode.accent}
                badge={mode.badge}
                wide={mode.wide}
                onClick={gameHandlers[index]}
              />
            ))}
          </div>
        </main>

        <aside className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-5 sm:p-6 text-white shadow-2xl xl:sticky xl:top-24">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="text-sm text-white/70 font-bold uppercase tracking-widest mb-1">{isAuthenticated ? 'Профиль' : 'Гостевой режим'}</div>
              <div className="text-2xl font-black break-words">{userProfile.username}</div>
            </div>
            <button
              type="button"
              onClick={isAuthenticated ? onOpenProfile : onOpenLogin}
              className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black hover:bg-white/25 transition shrink-0"
            >
              {isAuthenticated ? 'Профиль' : 'Войти'}
            </button>
          </div>

          {!isAuthenticated ? (
            <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
              <div className="text-5xl mb-3">{getPetEmoji(userProfile.pet)}</div>
              <h2 className="text-xl font-black mb-2">Сохраните прогресс</h2>
              <p className="text-sm text-white/75 leading-relaxed mb-4">
                Зарегистрируйтесь, чтобы развивать персонажа, копить XP и монеты, покупать предметы и работать со своим словарём.
              </p>
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full rounded-2xl bg-white text-indigo-700 py-3 font-black hover:bg-indigo-50 transition"
              >
                Создать аккаунт
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={onOpenShop} className="rounded-2xl bg-white/10 p-4 border border-white/10 text-left hover:bg-white/15 transition">
                  <div className="text-3xl mb-2">🪙</div>
                  <div className="text-2xl font-black">{userProfile.coins}</div>
                  <div className="text-xs text-white/65 font-bold uppercase tracking-widest">монет</div>
                </button>
                <button
                  type="button"
                  onClick={onOpenPetRoom}
                  className="group rounded-2xl bg-white/10 p-4 border border-white/10 text-left hover:bg-white/15 transition overflow-hidden"
                  title="Открыть комнату персонажа"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/95 ring-1 ring-white/50 shadow-sm flex items-center justify-center">
                      {characterAssetUrl ? (
                        <img
                          src={characterAssetUrl}
                          alt={userProfile.pet.name}
                          className="h-[4.25rem] w-[4.25rem] object-cover scale-125 transition-transform group-hover:scale-[1.33]"
                          draggable={false}
                        />
                      ) : (
                        <div className="text-4xl">{getPetEmoji(userProfile.pet)}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-widest text-white/60">Комната</div>
                      <div className="text-lg font-black leading-tight truncate">{userProfile.pet.name}</div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-2xl font-black leading-none">{userProfile.pet.level}</div>
                      <div className="mt-1 text-xs text-white/65 font-bold uppercase tracking-widest">уровень</div>
                    </div>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black text-white/80 group-hover:bg-white/25 transition">Открыть</span>
                  </div>
                </button>
              </div>

              <div className="mt-4 rounded-3xl bg-white/10 border border-white/10 p-4">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white/65 mb-2">
                  <span>XP</span>
                  <span title="XP даётся за игры. Победы дают больше опыта, но попытки тоже поощряются.">{userProfile.pet.xp}</span>
                </div>
                <div className="h-3 rounded-full bg-white/15 overflow-hidden mb-3">
                  <div className="h-full bg-white" style={{ width: `${xpProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white/65 mb-2">
                  <span>Настроение</span>
                  <span title="Игры повышают настроение до 70/100, лакомства — выше.">{moodScore}/100</span>
                </div>
                <div className="h-3 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full bg-white/80" style={{ width: `${moodScore}%` }} />
                </div>
                <div className="mt-3 text-xs text-white/70 font-bold">{getCharacterStageLabel(userProfile.pet.stage)}</div>
              </div>

              <button
                type="button"
                onClick={onOpenShop}
                className="mt-5 w-full rounded-2xl bg-white text-indigo-700 py-3 font-black hover:bg-indigo-50 transition"
              >
                Открыть магазин
              </button>
            </>
          )}
        </aside>
      </section>
    </ScreenContainer>
  );
};