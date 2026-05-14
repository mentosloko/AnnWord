import React from 'react';

interface AuthBootstrapGateProps {
  title?: string;
  message?: string;
  error?: string | null;
  onContinueAsGuest?: () => void;
}

export const AuthBootstrapGate: React.FC<AuthBootstrapGateProps> = ({
  title = 'Восстанавливаем вход',
  message = 'Получаем сессию и загружаем профиль. Это защищает приложение от временного состояния «гость» после обновления страницы.',
  error,
  onContinueAsGuest,
}) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 px-4 text-white">
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
      {!error && <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />}
      <div className="text-xl font-black">{error ? 'Не удалось восстановить вход' : title}</div>
      <div className="mt-3 text-sm leading-relaxed text-white/75">{error || message}</div>
      {error && onContinueAsGuest && (
        <button
          type="button"
          onClick={onContinueAsGuest}
          className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-indigo-950 shadow-lg transition hover:bg-indigo-50"
        >
          Продолжить как гость
        </button>
      )}
    </div>
  </div>
);
