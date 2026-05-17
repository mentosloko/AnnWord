import React from 'react';
import { UserProfile } from '../../types';
import { getCharacterProgressPercent, getCharacterProgressText, getCharacterStageLabel, normalizeMoodScore } from '../../services/gamificationRules';
import { getPetEmoji, getPetNeedSnapshot } from '../../services/petEngine';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ProfileScreenProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onBackHome: () => void;
  onOpenShop: () => void;
  onOpenPetRoom: () => void;
  onLogin: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  isAuthenticated,
  onBackHome,
  onOpenShop,
  onOpenPetRoom,
  onLogin,
}) => {
  const winRate = userProfile.stats.gamesPlayed > 0
    ? Math.round((userProfile.stats.gamesWon / userProfile.stats.gamesPlayed) * 100)
    : 0;
  const moodScore = normalizeMoodScore(userProfile.pet);
  const petSnapshot = getPetNeedSnapshot(userProfile.pet);
  const xpProgress = getCharacterProgressPercent(userProfile.pet);

  return (
    <ScreenContainer className="max-w-4xl pb-24">
      <button
        type="button"
        onClick={onBackHome}
        className="mb-6 rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
      >
        ← На главный экран
      </button>

      <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">
          <div>
            <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-2">Профиль</div>
            <h1 className="text-3xl sm:text-4xl font-black text-indigo-950">{userProfile.username}</h1>
            <p className="text-gray-500 mt-2">
              {isAuthenticated
                ? 'Прогресс, персонаж и словарь сохраняются в аккаунте.'
                : 'Гостевой режим: зарегистрируйтесь, чтобы развивать персонажа и работать со своим словарём.'}
            </p>
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-white font-black hover:bg-indigo-700 transition"
            >
              Зарегистрироваться
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-3xl bg-indigo-50 border border-indigo-100 p-5">
            <div className="text-3xl mb-2">🎮</div>
            <div className="text-2xl font-black text-indigo-950">{userProfile.stats.gamesPlayed}</div>
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">игр</div>
          </div>
          <div className="rounded-3xl bg-green-50 border border-green-100 p-5">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-2xl font-black text-green-900">{userProfile.stats.gamesWon}</div>
            <div className="text-xs font-bold text-green-500 uppercase tracking-widest">побед</div>
          </div>
          <div className="rounded-3xl bg-yellow-50 border border-yellow-100 p-5">
            <div className="text-3xl mb-2">📈</div>
            <div className="text-2xl font-black text-yellow-900">{winRate}%</div>
            <div className="text-xs font-bold text-yellow-600 uppercase tracking-widest">win rate</div>
          </div>
          <button
            type="button"
            onClick={onOpenShop}
            className="rounded-3xl bg-purple-50 border border-purple-100 p-5 text-left hover:bg-purple-100 transition"
          >
            <div className="text-3xl mb-2">🪙</div>
            <div className="text-2xl font-black text-purple-900">{userProfile.coins}</div>
            <div className="text-xs font-bold text-purple-500 uppercase tracking-widest">монет</div>
          </button>
        </div>

        {!isAuthenticated && (
          <section className="mb-8 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/70 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-indigo-950">Развитие персонажа доступно в аккаунте</h2>
                <p className="text-sm text-indigo-700 mt-1">После регистрации сохранятся XP, монеты, покупки и персональный словарь.</p>
              </div>
              <button type="button" onClick={onLogin} className="rounded-2xl bg-indigo-600 px-5 py-3 text-white font-black hover:bg-indigo-700 transition">
                Создать аккаунт
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <h2 className="text-xl font-black text-gray-900">Персонаж</h2>
            <button
              type="button"
              onClick={isAuthenticated ? onOpenPetRoom : onLogin}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-white font-black hover:bg-indigo-700 transition"
            >
              {isAuthenticated ? 'Открыть комнату' : 'Зарегистрироваться'}
            </button>
          </div>

          <button
            type="button"
            onClick={isAuthenticated ? onOpenPetRoom : onLogin}
            className="w-full rounded-[2rem] bg-white border-2 border-indigo-50 p-5 text-left hover:border-indigo-200 hover:shadow-md transition"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="text-6xl sm:text-7xl">{getPetEmoji(userProfile.pet)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-2xl text-gray-900">{userProfile.pet.name}</div>
                <div className="text-sm font-bold text-indigo-500 mt-1">
                  Уровень {userProfile.pet.level} · {getCharacterStageLabel(userProfile.pet.stage)}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                      <span>XP</span>
                      <span title="XP даётся за завершение игр. Победы дают больше опыта, но небольшая награда есть и за попытку.">{userProfile.pet.xp}</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                      <div className="h-full bg-indigo-500" style={{ width: `${xpProgress}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-gray-400">{getCharacterProgressText(userProfile.pet)}</div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                      <span>Настроение</span>
                      <span title="Игры повышают настроение до 70/100. Лакомства из магазина могут поднять его выше.">{moodScore}/100</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                      <div className="h-full bg-green-500" style={{ width: `${moodScore}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-gray-400">{petSnapshot.statusLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </section>
      </div>
    </ScreenContainer>
  );
};