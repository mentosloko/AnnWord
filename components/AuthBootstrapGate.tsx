import React from 'react';

interface AuthBootstrapGateProps {
  error?: string | null;
  onRetry?: () => void;
  mode?: 'blocking' | 'inline';
  intent?: 'default' | 'yandex' | 'payment';
}

type GateIntent = NonNullable<AuthBootstrapGateProps['intent']>;

type GateCopy = {
  eyebrow: string;
  title: string;
  description: string;
  footer: string;
};

const copyByIntent: Record<GateIntent, GateCopy> = {
  default: {
    eyebrow: 'Синхронизация',
    title: 'Готовим приложение',
    description: 'Проверяем вход и загружаем данные аккаунта.',
    footer: 'Открываем AnnWord…',
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

const inferIntentFromLocation = (): GateIntent => {
  if (typeof window === 'undefined') return 'default';
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  if (payment === 'success' || payment === 'fail') return 'payment';
  if (params.get('auth') === 'yandex' || params.has('oauth_code')) return 'yandex';
  return 'default';
};

const SkeletonLines = () => <div className="space-y-3" aria-hidden="true"><div className="h-4 w-36 animate-pulse rounded-full bg-indigo-100" /><div className="h-3 w-full animate-pulse rounded-full bg-slate-100" /><div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" /></div>;

export const AuthBootstrapGate: React.FC<AuthBootstrapGateProps> = ({ error, onRetry, mode = 'blocking', intent = 'default' }) => {
  const resolvedIntent = intent === 'default' ? inferIntentFromLocation() : intent;
  const copy = copyByIntent[resolvedIntent];

  if (error) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 px-4 text-indigo-950 backdrop-blur-sm"><div className="w-full max-w-sm rounded-[2rem] border-2 border-rose-100 bg-white p-5 text-center shadow-xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl">🧩</div><h1 className="mt-4 text-xl font-black text-indigo-950">Не удалось восстановить вход</h1><p className="mt-2 text-sm font-bold leading-relaxed text-gray-500">{error}</p><p className="mt-3 rounded-2xl bg-indigo-50 p-3 text-xs font-bold text-indigo-700">Гостевой режим не включаю автоматически, чтобы не перепутать профиль и не сбросить прогресс.</p>{onRetry && <button type="button" onClick={onRetry} className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700">Повторить</button>}</div></div>;

  // A cached profile is already safe to render while the session is refreshed in the
  // background. Showing a status chip on every visit made a normal refresh look like
  // a blocking operation and caused visible layout noise. Keep only blocking flows
  // (first visit, OAuth and payment return) and real errors visible.
  if (mode === 'inline') return null;

  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-4 text-indigo-950"><div className="w-full max-w-md rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-indigo-100 text-2xl">{resolvedIntent === 'yandex' ? '🔐' : resolvedIntent === 'payment' ? '✅' : ''}</div><div className="flex-1"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">{copy.eyebrow}</div><h1 className="mt-1 text-xl font-black text-indigo-950">{copy.title}</h1></div></div><div className="rounded-3xl bg-indigo-50/60 p-4"><p className="text-sm font-bold leading-relaxed text-slate-600">{copy.description}</p><div className="mt-4"><SkeletonLines /></div></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /></div><p className="mt-4 text-center text-xs font-bold text-gray-400">{copy.footer}</p></div></div>;
};