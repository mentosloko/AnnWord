import React from 'react';
import { UserProfile } from '../../types';
import { getPetEmoji } from '../../services/petEngine';
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
    className="group text-left rounded-3xl bg-white border-2 border-indigo-50 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
  >
    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">{icon}</div>
    <h3 className="text-xl font-black text-indigo-950 mb-2">{title}</h3>
    <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
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
  onOpenRules,
  onOpenLogin,
  onOpenProfile,
}) => {
  return (
    <ScreenContainer className="pb-24">
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center py-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-2 text-xs font-black text-indigo-600 uppercase tracking-widest mb-5">
            AnnWord · English vocabulary game
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-indigo-950 leading-tight mb-5">
            Учите английские слова через игру
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mb-7">
            Классический word game, анаграммы, спринт, виселица и память — с единым словарём,
            монетами и персонажем, который растёт от XP.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStartClassic}
              className="rounded-2xl bg-indigo-600 px-6 py-4 text-white font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
            >
              Играть
            </button>
            <button
              type="button"
              onClick={onOpenRules}
              className="rounded-2xl bg-white border-2 border-indigo-100 px-6 py-4 text-indigo-700 font-black hover:bg-indigo-50 transition"
            >
              Правила
            </button>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="rounded-2xl bg-gray-950 px-6 py-4 text-white font-black hover:bg-gray-800 transition"
              >
                Войти
              </button>
            )}
          </div>
        </div>

        <aside className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <div className="text-sm text-white/70 font-bold uppercase tracking-widest mb-1">Профиль</div>
              <div className="text-2xl font-black">{userProfile.username}</div>
            </div>
            <button
              type="button"
              onClick={isAuthenticated ? onOpenProfile : onOpenLogin}
              className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black hover:bg-white/25 transition"
            >
              {isAuthenticated ? 'Профиль' : 'Войти'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <div className="text-3xl mb-2">🪙</div>
              <div className="text-2xl font-black">{userProfile.coins}</div>
              <div className="text-xs text-white/65 font-bold uppercase tracking-widest">монет</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <div className="text-3xl mb-2">{getPetEmoji(userProfile.pet)}</div>
              <div className="text-2xl font-black">{userProfile.pet.level}</div>
              <div className="text-xs text-white/65 font-bold uppercase tracking-widest">уровень</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenShop}
            className="mt-5 w-full rounded-2xl bg-white text-indigo-700 py-3 font-black hover:bg-indigo-50 transition"
          >
            Открыть магазин
          </button>
        </aside>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
        <GameCard title="Классика" description="Угадайте слово за несколько попыток." icon="🧩" onClick={onStartClassic} />
        <GameCard title="Анаграммы" description="Соберите слово из перемешанных букв." icon="🔀" onClick={onStartAnagrams} />
        <GameCard title="Спринт" description="Быстро выбирайте правильные ответы." icon="⚡" onClick={onStartSprint} />
        <GameCard title="Виселица" description="Угадайте слово по буквам." icon="🎯" onClick={onStartHangman} />
        <GameCard title="Память" description="Запоминайте пары слов и значений." icon="🧠" onClick={onStartMemory} />
      </section>
    </ScreenContainer>
  );
};
