import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile, ViewState } from '../../types';
import { CoinIcon } from '../CoinIcon';

interface AppHeaderProps { route: ViewState; userProfile: UserProfile; isAuthenticated: boolean; onHomeClick: () => void; onLoginClick: () => void; onLogoutClick: () => void; onProfileClick?: () => void; onShopClick?: () => void; onAdminClick?: () => void; onAdultRoomClick?: () => void; onDictionaryStudioClick?: () => void; }
const navButton = 'rounded-xl px-3 py-2 text-sm font-black transition hover:bg-indigo-50';
const setupRoutes: ViewState[] = ['account_mode_setup', 'family_setup', 'character_onboarding'];

export const AppHeader: React.FC<AppHeaderProps> = ({ route, userProfile, isAuthenticated, onHomeClick, onLoginClick, onLogoutClick, onProfileClick, onShopClick, onAdminClick, onAdultRoomClick, onDictionaryStudioClick }) => {
  const isAdmin = userProfile.role === 'admin';
  const isParent = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isPractice = isAuthenticated && !isParent && !isTeacher;
  const premiumActive = isAdmin || (userProfile.subscriptionTier === 'premium' && (!userProfile.premiumExpiresAt || Date.parse(userProfile.premiumExpiresAt) > Date.now()));
  const hasDictionaryStudio = isTeacher || isAdmin || (isPractice && premiumActive);
  const showKidsEconomy = isAuthenticated && isParent;
  const isSetupStage = setupRoutes.includes(route);
  const modeLabel = isSetupStage || !isAuthenticated ? 'AnnWord' : isTeacher ? 'Teacher' : isParent ? 'Kids' : isPractice ? 'Practice' : 'AnnWord';
  const profileLabel = isTeacher ? 'Кабинет преподавателя' : isParent ? 'Профиль ребёнка' : 'Статистика';
  const cabinetLabel = isTeacher ? 'Ученики' : 'Кабинет родителя';
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!accountMenuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [menuOpen]);
  const go = (callback?: () => void) => { setMenuOpen(false); callback?.(); };
  const navItems = useMemo(() => {
    if (!isAuthenticated || isSetupStage) return [] as Array<{ label: string; onClick?: () => void; active?: boolean }>;
    const items: Array<{ label: string; onClick?: () => void; active?: boolean }> = [{ label: 'Главная', onClick: onHomeClick, active: route === 'landing' }];
    if (isPractice) {
      if (onDictionaryStudioClick) items.push({ label: 'Словари', onClick: onDictionaryStudioClick, active: route === 'dictionary_studio' || route === 'setup' });
      if (onProfileClick) items.push({ label: 'Статистика', onClick: onProfileClick, active: route === 'profile' });
    }
    if (isParent) {
      if (onShopClick) items.push({ label: 'Магазин', onClick: onShopClick, active: route === 'shop' });
      if (onAdultRoomClick) items.push({ label: 'Кабинет родителя', onClick: onAdultRoomClick, active: route === 'adult_room' });
    }
    if (isTeacher) {
      if (onAdultRoomClick) items.push({ label: 'Ученики', onClick: onAdultRoomClick, active: route === 'adult_room' });
      if (onDictionaryStudioClick) items.push({ label: 'Словари', onClick: onDictionaryStudioClick, active: route === 'dictionary_studio' });
    }
    if (isAdmin && onAdminClick) items.push({ label: 'Админ', onClick: onAdminClick, active: route === 'admin' });
    return items;
  }, [isAuthenticated, isSetupStage, isPractice, isParent, isTeacher, isAdmin, onHomeClick, onDictionaryStudioClick, onProfileClick, onShopClick, onAdultRoomClick, onAdminClick, route]);

  return <>
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-2 border-b border-indigo-50 bg-white/85 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-2"><button type="button" onClick={onHomeClick} aria-label="AnnWord — на главную" className="flex min-w-0 items-center gap-2 rounded-xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:gap-2.5"><img src="/assets/branding/annword-logo-mark.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11" draggable={false}/><span className="truncate text-lg font-black leading-none text-[#121821] sm:text-xl">AnnWord</span></button>{modeLabel !== 'AnnWord' && <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600 sm:inline-flex">{modeLabel}</span>}</div>
      {navItems.length > 0 && <nav className="hidden items-center gap-1 lg:flex" aria-label="Основная навигация">{navItems.map(item => <button key={item.label} type="button" onClick={item.onClick} aria-current={item.active ? 'page' : undefined} className={`${navButton} ${item.active ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-900'}`}>{item.label}</button>)}</nav>}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{showKidsEconomy && !isSetupStage && <button type="button" onClick={onShopClick} aria-label={'Монеты: ' + userProfile.coins + '. Открыть магазин'} className="flex items-center gap-1 rounded-xl border border-yellow-100 bg-yellow-50 px-2.5 py-2 text-sm font-black text-yellow-700 transition hover:bg-yellow-100 sm:px-3"><span>{userProfile.coins}</span><CoinIcon className="text-base" /></button>}{!isAuthenticated && <button type="button" onClick={onLoginClick} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">Войти</button>}{isAuthenticated && !isSetupStage ? <div ref={accountMenuRef} className="relative"><button type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)} className="flex max-w-[122px] items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 sm:max-w-[180px]"><span className="truncate" title={userProfile.username}>{userProfile.username}</span><span aria-hidden="true" className="text-xs text-indigo-400">▾</span></button>{menuOpen && <div role="menu" aria-label="Меню аккаунта" className="absolute right-0 top-[calc(100%+0.45rem)] z-50 w-60 rounded-2xl border border-indigo-100 bg-white p-1.5 shadow-xl"><button role="menuitem" type="button" onClick={() => go(onHomeClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">Главная · {modeLabel}</button>{onProfileClick && <button role="menuitem" type="button" onClick={() => go(isTeacher ? onAdultRoomClick : onProfileClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">{profileLabel}</button>}{showKidsEconomy && onShopClick && <button role="menuitem" type="button" onClick={() => go(onShopClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-indigo-800 transition hover:bg-indigo-50">Магазин</button>}{hasDictionaryStudio && onDictionaryStudioClick && <button role="menuitem" type="button" onClick={() => go(onDictionaryStudioClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">Словари</button>}{(isParent || isTeacher || isAdmin) && onAdultRoomClick && <button role="menuitem" type="button" onClick={() => go(onAdultRoomClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">{cabinetLabel}</button>}{isAdmin && onAdminClick && <button role="menuitem" type="button" onClick={() => go(onAdminClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-purple-700 transition hover:bg-purple-50">Администрирование</button>}<div className="my-1 h-px bg-indigo-50"/><button role="menuitem" type="button" onClick={() => go(onLogoutClick)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-600 transition hover:bg-gray-50">Выйти</button></div>}</div> : null}</div>
    </header>
    {navItems.length > 0 && <nav className="sticky top-[61px] z-30 flex gap-2 overflow-x-auto border-b border-indigo-50 bg-white/95 px-3 py-2 shadow-sm backdrop-blur lg:hidden" aria-label="Быстрая навигация">{navItems.map(item => <button key={item.label} type="button" onClick={item.onClick} aria-current={item.active ? 'page' : undefined} className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${item.active ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{item.label}</button>)}</nav>}
  </>;
};
