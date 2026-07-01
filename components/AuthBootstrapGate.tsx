import React from 'react';

interface AuthBootstrapGateProps {
  error?: string | null;
  onRetry?: () => void;
  mode?: 'blocking' | 'inline';
  intent?: 'default' | 'yandex' | 'payment';
}

type GateCopy = {
  eyebrow: string;
  title: string;
  description: string;
  footer: string;
};

const copyByIntent: Record<NonNullable<AuthBootstrapGateProps['intent']>, GateCopy> = {
  default: {
    eyebrow: 'Синхронизация',
    title: 'Готовим ваш профиль',
    description: 'Проверяем вход, прогресс и словари, чтобы открыть приложение с вашими данными.',
    footer: 'Восстанавливаем профиль и словари…',
  },
  yandex: {
    eyebrow: 'Вход через Яндекс',
    title: 'Завершаем вход',
    description: 'Получаем подтверждение от Яндекса и открываем ваш профиль AnnWord.',
    footer: 'Подключаем аккаунт Яндекса…',
  },
  payment: {
    eyebrow: 'Проверка оплаты',
    title: 'Подключаем Premium',
    description: 'Получили возврат после оплаты и проверяем подтверждение платежа.',
    footer: 'Проверяем статус Premium…',
  },
};

const SkeletonLines = () => <div className="space-y-3" aria-hidden="true"><div className="h-4 w-36 animate-pulse rounded-full bg-indigo-100" /><div className="h-3 w-full animate-pulse rounded-full bg-slate-100" /><div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" /></div>;

export const AuthBootstrapGate: React.FC<AuthBootstrapGateProps> = ({ error, onRetry, mode = 'blocking', intent = 'default' }) => {
  const copy = copyByIntent[intent];

  if (error) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 px-4 text-indigo-950 backdrop-blur-sm"><div className="w-full max-w-sm rounded-[2rem] border-2 border-rose-100 bg-white p-5 text-center shadow-xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl">🧩</div><h1 className="mt-4 text-xl font-black text-indigo-950">Не удалось восстановить вход</h1><p className="mt-2 text-sm font-bold leading-relaxed text-gray-500">{error}</p><p className="mt-3 rounded-2xl bg-indigo-50 p-3 text-xs font-bold text-indigo-700">Гостевой режим не включаю автоматически, чтобы не перепутать профиль и не сбросить прогресс.</p>{onRetry && <button type="button" onClick={onRetry} className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700">Повторить</button>}</div></div>;

  if (mode === 'inline') return <div className="pointer-events-none fixed inset-x-3 top-3 z-[9999] mx-auto max-w-md rounded-2xl border border-indigo-100 bg-white/90 px-4 py-3 shadow-lg shadow-indigo-950/5 backdrop-blur-md" role="status" aria-live="polite"><div className="flex items-center gap-3"><div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-indigo-100" /><div className="min-w-0 flex-1"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{copy.eyebrow}</div><div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-indigo-50"><div className="h-full w-1/3 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full bg-indigo-500" /></div></div></div><style>{`@keyframes loadingBar { 0% { transform: translateX(-120%); } 50% { transform: translateX(120%); } 100% { transform: translateX(320%); } }`}</style></div>;

  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-4 text-indigo-950"><div className="w-full max-w-md rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-indigo-100 text-2xl">{intent === 'yandex' ? '🔐' : intent === 'payment' ? '✅' : ''}</div><div className="flex-1"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{copy.eyebrow}</div><h1 className="mt-1 text-xl font-black text-indigo-950">{copy.title}</h1></div></div><div className="rounded-3xl bg-indigo-50/60 p-4"><p className="text-sm font-bold leading-relaxed text-slate-600">{copy.description}</p><div className="mt-4"><SkeletonLines /></div></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /></div><p className="mt-4 text-center text-xs font-bold text-gray-400">{copy.footer}</p></div></div>;
};
