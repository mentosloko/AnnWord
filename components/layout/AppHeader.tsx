import React from 'react';
import { UserProfile } from '../../types';

interface AppHeaderProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onProfileClick?: () => void;
  onShopClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  userProfile,
  isAuthenticated,
  onLoginClick,
  onLogoutClick,
  onProfileClick,
  onShopClick,
}) => {
  return (
    <header className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-white/80 backdrop-blur border-b border-indigo-50 sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">A</div>
        <div className="min-w-0">
          <div className="font-black text-indigo-950 leading-none truncate">AnnWord</div>
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest truncate">English game</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isAuthenticated && (
          <button
            type="button"
            onClick={onShopClick}
            className="hidden sm:flex items-center gap-1 rounded-xl bg-yellow-50 border border-yellow-100 px-3 py-2 text-sm font-black text-yellow-700 hover:bg-yellow-100 transition"
          >
            {userProfile.coins} 🪙
          </button>
        )}

        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={onProfileClick}
              className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition max-w-[120px] sm:max-w-[160px] truncate"
              title={userProfile.username}
            >
              {userProfile.username}
            </button>
            <button
              type="button"
              onClick={onLogoutClick}
              className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
            >
              Выйти
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 transition"
          >
            Зарегистрироваться
          </button>
        )}
      </div>
    </header>
  );
};