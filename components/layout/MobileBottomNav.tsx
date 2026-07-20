import React from 'react';
import { UserProfile, ViewState } from '../../types';

interface Props {
  route: ViewState;
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onHomeClick: () => void;
  onProfileClick?: () => void;
  onShopClick?: () => void;
  onAdultRoomClick?: () => void;
  onDictionaryStudioClick?: () => void;
}

type Item = { label: string; icon: string; active: boolean; onClick?: () => void };
const hiddenRoutes: ViewState[] = ['account_mode_setup', 'family_setup', 'character_onboarding', 'premium_success'];

export const MobileBottomNav: React.FC<Props> = ({ route, userProfile, isAuthenticated, onHomeClick, onProfileClick, onShopClick, onAdultRoomClick, onDictionaryStudioClick }) => {
  if (!isAuthenticated || hiddenRoutes.includes(route)) return null;
  const isParent = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const isAdmin = userProfile.role === 'admin';
  const homeActive = route === 'landing';
  const items: Item[] = isParent ? [
    { label: 'Игры', icon: '▦', active: homeActive, onClick: onHomeClick },
    { label: 'Питомец', icon: '♡', active: route === 'pet_room', onClick: () => window.dispatchEvent(new CustomEvent('annword:navigate-pet')) },
    { label: 'Магазин', icon: '◇', active: route === 'shop', onClick: onShopClick },
    { label: 'Родителю', icon: '⌂', active: route === 'adult_room', onClick: onAdultRoomClick },
  ] : isTeacher ? [
    { label: 'Главная', icon: '⌂', active: homeActive, onClick: onHomeClick },
    { label: 'Ученики', icon: '◎', active: route === 'adult_room', onClick: onAdultRoomClick },
    { label: 'Словари', icon: '▤', active: route === 'dictionary_studio', onClick: onDictionaryStudioClick },
    { label: 'Профиль', icon: '○', active: route === 'profile', onClick: onProfileClick },
  ] : isAdmin ? [
    { label: 'Главная', icon: '⌂', active: homeActive, onClick: onHomeClick },
    { label: 'Словари', icon: '▤', active: route === 'dictionary_studio' || route === 'dictionary_settings', onClick: onDictionaryStudioClick },
    { label: 'Профиль', icon: '○', active: route === 'profile', onClick: onProfileClick },
  ] : [
    { label: 'Игры', icon: '▦', active: homeActive, onClick: onHomeClick },
    { label: 'Словарь', icon: '▤', active: route === 'dictionary_studio' || route === 'dictionary_settings', onClick: onDictionaryStudioClick },
    { label: 'Прогресс', icon: '↗', active: route === 'profile', onClick: onProfileClick },
  ];
  const available = items.filter(item => Boolean(item.onClick));
  if (!available.length) return null;
  return <nav aria-label="Основная мобильная навигация" className="fixed inset-x-0 bottom-0 z-50 border-t border-indigo-100 bg-white/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(49,46,129,0.08)] backdrop-blur lg:hidden">
    <div className="mx-auto grid max-w-lg grid-flow-col auto-cols-fr gap-1">{available.map(item => <button key={item.label} type="button" onClick={item.onClick} aria-current={item.active ? 'page' : undefined} className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl px-1 text-[11px] font-bold transition ${item.active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-indigo-50/60 hover:text-indigo-700'}`}><span aria-hidden="true" className="text-lg leading-none">{item.icon}</span><span className="mt-1 truncate">{item.label}</span></button>)}</div>
  </nav>;
};
