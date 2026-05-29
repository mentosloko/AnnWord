import React from 'react';
import { UserProfile } from '../../types';
import { getCharacterProgressPercent, getCharacterProgressText, getCharacterStageLabel, normalizeMoodScore } from '../../services/gamificationRules';
import { getPetEmoji, getPetNeedSnapshot } from '../../services/petEngine';
import { getPetCharacterAssetUrl } from '../../services/petAssets';
import { ScreenContainer } from '../layout/ScreenContainer';
import { CoinIcon } from '../CoinIcon';

interface ProfileScreenProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onBackHome: () => void;
  onOpenShop: () => void;
  onOpenPetRoom: () => void;
  onLogin: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ userProfile, isAuthenticated, onBackHome, onOpenShop, onOpenPetRoom, onLogin }) => {
  const winRate = userProfile.stats.gamesPlayed > 0 ? Math.round((userProfile.stats.gamesWon / userProfile.stats.gamesPlayed) * 100) : 0;
  const moodScore = normalizeMoodScore(userProfile.pet);
  const petSnapshot = getPetNeedSnapshot(userProfile.pet);
  const xpProgress = getCharacterProgressPercent(userProfile.pet);
  const characterAssetUrl = getPetCharacterAssetUrl(userProfile.pet);
  const customWordsCount = userProfile.customDictionaryEn.length;

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="max-w-2xl pb-24">
        <button type="button" onClick={onBackHome} className="mb-5 rounded-xl border-2 border-indigo-100 bg-white px-4 py-2 font-bold text-indigo-700 transition hover:bg-indigo-50">← На главный экран</button>
        <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-indigo-50 text-6xl">{getPetEmoji(userProfile.pet)}</div>
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-300">Игра без входа</div>
          <h1 className="text-3xl font-black text-indigo-950">Сохраните свой прогресс</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">Создайте аккаунт, чтобы сохранить питомца, монеты, покупки и личный словарь на всех устройствах.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {['Питомец', 'Монеты', 'Покупки', 'Словарь'].map(item => <div key={item} className="rounded-2xl bg-indigo-50 px-3 py-4 text-center text-sm font-black text-indigo-700">{item}</div>)}
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onLogin} className="rounded-2xl bg-indigo-600 px-6 py-3.5 font-black text-white transition hover:bg-indigo-700">Создать аккаунт</button>
            <button type="button" onClick={onBackHome} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-3.5 font-black text-indigo-700 transition hover:bg-indigo-50">Продолжить без входа</button>
          </div>
        </section>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="max-w-4xl pb-24">
      <button type="button" onClick={onBackHome} className="mb-6 rounded-xl border-2 border-indigo-100 bg-white px-4 py-2 font-bold text-indigo-700 transition hover:bg-indigo-50">← На главный экран</button>
      <div className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-300">Профиль</div><h1 className="text-3xl font-black text-indigo-950 sm:text-4xl">{userProfile.username}</h1><p className="mt-2 text-gray-500">Ваш прогресс сохраняется в аккаунте.</p></div>
          <button type="button" onClick={onOpenPetRoom} className="rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white transition hover:bg-indigo-700">К питомцу</button>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4 sm:p-5"><div className="mb-2 text-3xl">🎮</div><div className="text-2xl font-black text-indigo-950">{userProfile.stats.gamesPlayed}</div><div className="text-xs font-bold uppercase tracking-widest text-indigo-400">игр</div></div>
          <div className="rounded-3xl border border-green-100 bg-green-50 p-4 sm:p-5"><div className="mb-2 text-3xl">🏆</div><div className="text-2xl font-black text-green-900">{userProfile.stats.gamesWon}</div><div className="text-xs font-bold uppercase tracking-widest text-green-500">побед</div></div>
          <div className="rounded-3xl border border-yellow-100 bg-yellow-50 p-4 sm:p-5"><div className="mb-2 text-3xl">📈</div><div className="text-2xl font-black text-yellow-900">{winRate}%</div><div className="text-xs font-bold uppercase tracking-widest text-yellow-600">процент побед</div></div>
          <button type="button" onClick={onOpenShop} className="rounded-3xl border border-purple-100 bg-purple-50 p-4 text-left transition hover:bg-purple-100 sm:p-5"><div className="mb-2 text-3xl"><CoinIcon className="text-[2rem]" /></div><div className="text-2xl font-black text-purple-900">{userProfile.coins}</div><div className="text-xs font-bold uppercase tracking-widest text-purple-500">монет</div></button>
        </div>

        <section className="mb-5 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Личный словарь</div><div className="mt-1 text-lg font-black text-indigo-950">{customWordsCount > 0 ? `${customWordsCount} слов` : 'Пока не загружен'}</div></div><div className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-indigo-600">Настраивается перед игрой</div></div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
          <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-black text-gray-900">Питомец</h2><button type="button" onClick={onOpenPetRoom} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700">Открыть комнату</button></div>
          <button type="button" onClick={onOpenPetRoom} className="w-full rounded-[2rem] border-2 border-indigo-50 bg-white p-5 text-left transition hover:border-indigo-200 hover:shadow-md">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] bg-indigo-50 text-6xl sm:h-32 sm:w-32 sm:text-7xl">{characterAssetUrl ? <img src={characterAssetUrl} alt={userProfile.pet.name} className="h-full w-full object-contain" draggable={false} /> : getPetEmoji(userProfile.pet)}</div>
              <div className="min-w-0 flex-1"><div className="text-2xl font-black text-gray-900">{userProfile.pet.name}</div><div className="mt-1 text-sm font-bold text-indigo-500">Уровень {userProfile.pet.level} · {getCharacterStageLabel(userProfile.pet.stage)}</div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><div><div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-widest text-gray-400"><span>Опыт</span><span>{userProfile.pet.xp}</span></div><div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-gray-100"><div className="h-full bg-indigo-500" style={{ width: `${xpProgress}%` }} /></div><div className="mt-1 text-[11px] font-bold text-gray-400">{getCharacterProgressText(userProfile.pet)}</div></div><div><div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-widest text-gray-400"><span>Настроение</span><span>{moodScore}/100</span></div><div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-gray-100"><div className="h-full bg-green-500" style={{ width: `${moodScore}%` }} /></div><div className="mt-1 text-[11px] font-bold text-gray-400">{petSnapshot.statusLabel}</div></div></div>
              </div>
            </div>
          </button>
        </section>
      </div>
    </ScreenContainer>
  );
};
