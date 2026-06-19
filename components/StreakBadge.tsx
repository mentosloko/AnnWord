import React from 'react';

type StreakBadgeTone = {
  icon: string;
  label: string;
  className: string;
  ringClassName: string;
};

const BADGES: StreakBadgeTone[] = [
  { icon: '🌱', label: 'Старт', className: 'from-emerald-100 to-lime-50 text-emerald-700', ringClassName: 'ring-emerald-100' },
  { icon: '✨', label: 'Искра', className: 'from-sky-100 to-indigo-50 text-sky-700', ringClassName: 'ring-sky-100' },
  { icon: '🔥', label: 'Огонёк', className: 'from-orange-100 to-amber-50 text-orange-700', ringClassName: 'ring-orange-100' },
  { icon: '⚡', label: 'Ритм', className: 'from-yellow-100 to-orange-50 text-yellow-700', ringClassName: 'ring-yellow-100' },
  { icon: '💎', label: 'Фокус', className: 'from-cyan-100 to-blue-50 text-cyan-700', ringClassName: 'ring-cyan-100' },
  { icon: '🚀', label: 'Разгон', className: 'from-indigo-100 to-sky-50 text-indigo-700', ringClassName: 'ring-indigo-100' },
  { icon: '🏅', label: 'Неделя', className: 'from-amber-100 to-yellow-50 text-amber-700', ringClassName: 'ring-amber-100' },
  { icon: '🌟', label: 'Звезда', className: 'from-violet-100 to-fuchsia-50 text-violet-700', ringClassName: 'ring-violet-100' },
  { icon: '🧠', label: 'Память', className: 'from-purple-100 to-indigo-50 text-purple-700', ringClassName: 'ring-purple-100' },
  { icon: '🎯', label: 'Точность', className: 'from-rose-100 to-orange-50 text-rose-700', ringClassName: 'ring-rose-100' },
  { icon: '🛡️', label: 'Серия', className: 'from-slate-100 to-blue-50 text-slate-700', ringClassName: 'ring-slate-100' },
  { icon: '⚙️', label: 'Привычка', className: 'from-blue-100 to-cyan-50 text-blue-700', ringClassName: 'ring-blue-100' },
  { icon: '🌈', label: 'Поток', className: 'from-pink-100 to-sky-50 text-pink-700', ringClassName: 'ring-pink-100' },
  { icon: '💫', label: 'Импульс', className: 'from-fuchsia-100 to-purple-50 text-fuchsia-700', ringClassName: 'ring-fuchsia-100' },
  { icon: '🦊', label: 'Хитрость', className: 'from-orange-100 to-rose-50 text-orange-700', ringClassName: 'ring-orange-100' },
  { icon: '🏆', label: 'Сила', className: 'from-yellow-100 to-amber-50 text-yellow-800', ringClassName: 'ring-yellow-100' },
  { icon: '🐉', label: 'Драйв', className: 'from-emerald-100 to-teal-50 text-emerald-700', ringClassName: 'ring-emerald-100' },
  { icon: '👑', label: 'Мастер', className: 'from-amber-100 to-orange-50 text-amber-800', ringClassName: 'ring-amber-100' },
  { icon: '🌋', label: 'Пик', className: 'from-red-100 to-orange-50 text-red-700', ringClassName: 'ring-red-100' },
  { icon: '💯', label: 'Легенда', className: 'from-indigo-100 to-purple-50 text-indigo-700', ringClassName: 'ring-indigo-100' },
];

const getBadge = (days: number): StreakBadgeTone => BADGES[Math.min(20, Math.max(1, Math.round(days || 1))) - 1] || BADGES[0];

export const StreakBadge: React.FC<{ days: number; className?: string }> = ({ days, className = '' }) => {
  const badge = getBadge(days);
  const displayDays = Math.max(1, Math.round(days || 1));
  return <span title={`${displayDays} дней подряд · ${badge.label}`} aria-label={`${displayDays} дней подряд`} className={`inline-flex min-w-[4rem] shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-br px-3 py-2 text-left shadow-sm ring-4 ${badge.className} ${badge.ringClassName} ${className}`}>
    <span className="text-xl leading-none" aria-hidden="true">{badge.icon}</span>
    <span className="flex flex-col leading-none">
      <span className="text-lg font-black">{displayDays}</span>
      <span className="mt-0.5 text-[9px] font-black uppercase tracking-widest opacity-70">{displayDays <= 20 ? badge.label : '20+'}</span>
    </span>
  </span>;
};
