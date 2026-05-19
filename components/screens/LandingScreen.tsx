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
  },
];

const GameModeCard: React.FC<{
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accent: string;
  onClick: () => void;
}> = ({ title, subtitle, description, icon, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative overflow-hidden text-left rounded-[2rem] bg-white border-2 border-indigo-50 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all min-h-[190px]"
    aria-label={`Играть: ${title}`}
  >
    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-4xl shadow-sm group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600 opacity-75 group-hover:opacity-100 transition">
        →
      </span>
    </div>
    <div className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-1">{subtitle}</div>
    <h3 className="text-2xl sm:text-3xl font-black text-indigo-950 mb-2">{title}</h3>
    <p className="text-sm sm:text-base text-gray-500 leading-relaxed">{description}</p>
  </button>
);

const ProgressMiniBar: React.FC<{ label: string; value: number; text: string; title: string }> = ({ label, value, text, title }) => (
  <div className="min-w-[160px] flex-1">
    <div className="mb-1 flex justify-between gap-3 text-[11px] font-black uppercase tracking-widest text-white/65">
      <span>{label}</span>
      <span title={title}>{text}</span>
    </div>
    <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
      <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
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
      <section className="py-5 sm:py-7">
        <div className="mb-5 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-4 sm:p-5 text-white shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {!isAuthenticated ? (
              <>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-4xl ring-1 ring-white/20">
                    {getPetEmoji(userProfile.pet)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-widest text-white/60">Гостевой режим</div>
                    <h2 className="mt-1 text-2xl font-black leading-tight">Сохраните прогресс</h2>
                    <p className="mt-1 max-w-2xl text-sm font-bold text-white/70">
                      Зарегистрируйтесь, чтобы развивать персонажа, копить XP и использовать свой словарь.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="w-full rounded-2xl bg-white px-5 py-3 font-black text-indigo-700 transition hover:bg-indigo-50 sm:w-fit"
                >
                  Создать аккаунт
                </button>
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-4">
                  <button
                    type="button"
                    onClick={onOpenPetRoom}
                    className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white/95 shadow-sm ring-1 ring-white/50 transition hover:scale-105"
                    title="Открыть комнату персонажа"
                  >
                    {characterAssetUrl ? (
                      <img
                        src={characterAssetUrl}
                        alt={userProfile.pet.name}
                        className="h-24 w-24 object-cover scale-125 transition-transform group-hover:scale-[1.35]"
                        draggable={false}
                      />
                    ) : (
                      <div className="text-5xl">{getPetEmoji(userProfile.pet)}</div>
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-widest text-white/60">{getCharacterStageLabel(userProfile.pet.stage)}</div>
                    <h2 className="mt-1 truncate text-2xl font-black leading-tight">{userProfile.username}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-white/70">
                      <span>Ур. {userProfile.pet.level}</span>
                      <span className="h-1 w-1 rounded-full bg-white/40" />
                      <span>{userProfile.coins} монет</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:min-w-[420px] xl:min-w-[520px]">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <ProgressMiniBar
                      label="XP"
                      value={xpProgress}
                      text={`${userProfile.pet.xp}`}
                      title="XP даётся за игры. Победы дают больше опыта, но попытки тоже поощряются."
                    />
                    <ProgressMiniBar
                      label="Настроение"
                      value={moodScore}
                      text={`${moodScore}/100`}
                      title="Игры повышают настроение до 70/100, лакомства — выше."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={onOpenPetRoom}
                      className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black transition hover:bg-white/25"
                    >
                      Комната
                    </button>
                    <button
                      type="button"
                      onClick={onOpenShop}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-indigo-700 transition hover:bg-indigo-50"
                    >
                      Магазин
                    </button>
                    <button
                      type="button"
                      onClick={onOpenProfile}
                      className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black transition hover:bg-white/25"
                    >
                      Профиль
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <main className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600">
                AnnWord · игровой хаб
              </div>
              <h1 className="mb-2 text-3xl font-black leading-tight text-indigo-950 sm:text-4xl">
                Выберите игру
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-gray-500 sm:text-base">
                Все режимы находятся на одном экране: выбирайте разные форматы тренировки, получайте XP и развивайте персонажа.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {GAME_MODES.map((mode, index) => (
              <GameModeCard
                key={mode.title}
                title={mode.title}
                subtitle={mode.subtitle}
                description={mode.description}
                icon={mode.icon}
                accent={mode.accent}
                onClick={gameHandlers[index]}
              />
            ))}
          </div>
        </main>
      </section>
    </ScreenContainer>
  );
};