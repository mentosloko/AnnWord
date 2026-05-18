import React from 'react';

interface AuthBootstrapGateProps {
  title?: string;
  message?: string;
  error?: string | null;
  onContinueAsGuest?: () => void;
}

export const AuthBootstrapGate: React.FC<AuthBootstrapGateProps> = ({
  title = 'Подключаем твой профиль',
  message = 'Проверяю вход, достаю словарь и зову персонажа. Ещё пару секунд — и можно играть.',
  error,
  onContinueAsGuest,
}) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 text-indigo-950">
    <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border-2 border-indigo-100 bg-white p-6 text-center shadow-2xl sm:p-8">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-100/70 blur-2xl" />
      <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-purple-100/80 blur-2xl" />

      <div className="relative">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-indigo-100 to-purple-100 text-6xl shadow-inner">
          {error ? '🧩' : '🐶'}
        </div>

        {!error && (
          <div className="mx-auto mb-5 h-2 w-40 overflow-hidden rounded-full bg-indigo-50 border border-indigo-100">
            <div className="h-full w-1/2 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full bg-indigo-600" />
          </div>
        )}

        <div className="rounded-3xl border-2 border-indigo-50 bg-indigo-50/70 px-4 py-3 text-left shadow-sm">
          <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Персонаж ждёт</div>
          <div className="mt-1 text-sm font-bold text-indigo-900">
            {error ? 'Не получилось быстро найти профиль. Можно продолжить как гость.' : 'Я почти готов! Загружаю твой словарь и прогресс.'}
          </div>
        </div>

        <div className="mt-6 text-2xl font-black text-indigo-950">{error ? 'Не удалось восстановить вход' : title}</div>
        <div className="mt-3 text-sm leading-relaxed text-gray-500">{error || message}</div>

        {error && onContinueAsGuest && (
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="mt-6 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
          >
            Продолжить как гость
          </button>
        )}
      </div>

      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-110%); }
          50% { transform: translateX(60%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  </div>
);