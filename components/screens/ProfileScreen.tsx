import React from 'react';
import { UserProfile } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ProfileScreenProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onBackHome: () => void;
  onOpenShop: () => void;
  onLogin: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  isAuthenticated,
  onBackHome,
  onOpenShop,
  onLogin,
}) => {
  const winRate = userProfile.stats.gamesPlayed > 0
    ? Math.round((userProfile.stats.gamesWon / userProfile.stats.gamesPlayed) * 100)
    : 0;

  return (
    <ScreenContainer className="max-w-4xl">
      <button
        type="button"
        onClick={onBackHome}
        className="mb-6 rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
      >
        ← На главный экран
      </button>

      <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">
          <div>
            <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-2">Профиль</div>
            <h1 className="text-4xl font-black text-indigo-950">{userProfile.username}</h1>
            <p className="text-gray-500 mt-2">
              {isAuthenticated ? 'Прогресс сохраняется в аккаунте.' : 'Гостевой режим: прогресс может не сохраниться.'}
            </p>
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-white font-black hover:bg-indigo-700 transition"
            >
              Войти
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

        <section className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
          <h2 className="text-xl font-black text-gray-900 mb-4">Питомец</h2>
          <div className="flex items-center gap-4">
            <div className="text-5xl">🦉</div>
            <div>
              <div className="font-black text-gray-900">{userProfile.pet.name}</div>
              <div className="text-sm text-gray-500">Уровень {userProfile.pet.level} · XP {userProfile.pet.xp}</div>
              <div className="text-sm text-gray-500">Голод {userProfile.pet.hunger}% · Энергия {userProfile.pet.energy}%</div>
            </div>
          </div>
        </section>
      </div>
    </ScreenContainer>
  );
};
