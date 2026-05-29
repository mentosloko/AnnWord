import React from 'react';
import { UserProfile } from '../../types';
import { CoinIcon } from '../CoinIcon';

interface AppHeaderProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onProfileClick?: () => void;
  onShopClick?: () => void;
  onAdminClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  userProfile,
  isAuthenticated,
  onLoginClick,
  onLogoutClick,
  onProfileClick,
  onShopClick,
  onAdminClick,
}) => {
  const isAdmin = userProfile.role === 'admin';

  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-2 border-b border-indigo-50 bg-white/85 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 font-black text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl">A</div>
        <div className="truncate text-lg font-black leading-none text-indigo-950 sm:text-xl">AnnWord</div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isAuthenticated && (
          <button
            type="button"
            onClick={onShopClick}
            aria-label={`Монеты: ${userProfile.coins}. Открыть магазин`}
            className="flex items-center gap-1 rounded-xl border border-yellow-100 bg-yellow-50 px-2.5 py-2 text-sm font-black text-yellow-700 transition hover:bg-yellow-100 sm:px-3"
          >
            <span>{userProfile.coins}</span><CoinIcon className="text-base" />
          </button>
        )}

        {isAuthenticated ? (
          <details className="group relative">
            <summary className="flex max-w-[122px] cursor-pointer list-none items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 sm:max-w-[180px] [&::-webkit-details-marker]:hidden">
              <span className="truncate" title={userProfile.username}>{userProfile.username}</span>
              <span aria-hidden="true" className="text-xs text-indigo-400">▾</span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.45rem)] z-50 w-48 rounded-2xl border border-indigo-100 bg-white p-1.5 shadow-xl">
              <button type="button" onClick={onProfileClick} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">Профиль</button>
              <button type="button" onClick={onShopClick} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">Магазин</button>
              {isAdmin && onAdminClick && (
                <button type="button" onClick={onAdminClick} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">Администрирование</button>
              )}
              <div className="my-1 h-px bg-indigo-50" />
              <button type="button" onClick={onLogoutClick} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-600 transition hover:bg-gray-50">Выйти</button>
            </div>
          </details>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-black text-white transition hover:bg-indigo-700 sm:px-4"
          >
            <span className="sm:hidden">Войти</span>
            <span className="hidden sm:inline">Войти</span>
          </button>
        )}
      </div>
    </header>
  );
};
