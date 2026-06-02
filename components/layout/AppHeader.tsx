import React, { useEffect, useRef } from 'react';
import { UserProfile } from '../../types';
import { CoinIcon } from '../CoinIcon';

interface AppHeaderProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onHomeClick: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onProfileClick?: () => void;
  onShopClick?: () => void;
  onAdminClick?: () => void;
  onAdultRoomClick?: () => void;
  onDictionaryStudioClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ userProfile, isAuthenticated, onHomeClick, onLoginClick, onLogoutClick, onProfileClick, onShopClick, onAdminClick, onAdultRoomClick, onDictionaryStudioClick }) => {
  const isAdmin = userProfile.role === 'admin';
  const hasAdultRoom = isAdmin || userProfile.role === 'parent' || userProfile.role === 'teacher';
  const hasPremiumStudio = hasAdultRoom || userProfile.subscriptionTier === 'premium';
  const accountMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeMenuOutside = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) accountMenuRef.current?.removeAttribute('open');
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') accountMenuRef.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', closeMenuOutside);
    document.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenuOutside);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, []);

  const navigateAndClose = (callback?: () => void) => {
    accountMenuRef.current?.removeAttribute('open');
    callback?.();
  };

  return <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-2 border-b border-indigo-50 bg-white/85 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
    <button type="button" onClick={onHomeClick} aria-label="AnnWord — на главную" className="flex min-w-0 items-center gap-2 rounded-xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:gap-2.5"><img src="/assets/branding/annword-logo-mark.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11" draggable={false}/><span className="truncate text-lg font-black leading-none text-[#121821] sm:text-xl">AnnWord</span></button>
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      {isAuthenticated && <button type="button" onClick={onShopClick} aria-label={`Монеты: ${userProfile.coins}. Открыть магазин`} className="flex items-center gap-1 rounded-xl border border-yellow-100 bg-yellow-50 px-2.5 py-2 text-sm font-black text-yellow-700 transition hover:bg-yellow-100 sm:px-3"><span>{userProfile.coins}</span><CoinIcon className="text-base" /></button>}
      {isAuthenticated ? <details ref={accountMenuRef} className="group relative"><summary className="flex max-w-[122px] cursor-pointer list-none items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 sm:max-w-[180px] [&::-webkit-details-marker]:hidden"><span className="truncate" title={userProfile.username}>{userProfile.username}</span><span aria-hidden="true" className="text-xs text-indigo-400">▾</span></summary><div className="absolute right-0 top-[calc(100%+0.45rem)] z-50 w-56 rounded-2xl border border-indigo-100 bg-white p-1.5 shadow-xl"><button type="button" onClick={() => navigateAndClose(onProfileClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">Профиль</button><button type="button" onClick={() => navigateAndClose(onShopClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">Магазин</button>{hasPremiumStudio && onDictionaryStudioClick && <button type="button" onClick={() => navigateAndClose(onDictionaryStudioClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">✨ Студия словарей</button>}{hasAdultRoom && onAdultRoomClick && <button type="button" onClick={() => navigateAndClose(onAdultRoomClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">👨‍👩‍👧 Комната взрослого</button>}{isAdmin && onAdminClick && <button type="button" onClick={() => navigateAndClose(onAdminClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">Администрирование</button>}<div className="my-1 h-px bg-indigo-50"/><button type="button" onClick={() => navigateAndClose(onLogoutClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-600 transition hover:bg-gray-50">Выйти</button></div></details> : <button type="button" onClick={onLoginClick} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-black text-white transition hover:bg-indigo-700 sm:px-4">Войти</button>}
    </div>
  </header>;
};