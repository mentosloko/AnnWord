import React from 'react';

interface AuthModalProps {
  isOpen: boolean;
  mode: 'login' | 'register';
  email: string;
  password: string;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
  onModeChange: (mode: 'login' | 'register') => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  onYandexLogin: () => void;
}

const LoaderIcon = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  email,
  password,
  error,
  isLoading,
  onClose,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onYandexLogin,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
            ⚠️ {error}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Электронная почта</label>
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="user@example.com"
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Пароль</label>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? <LoaderIcon /> : null}
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-bold text-gray-400 uppercase">или</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={onYandexLogin}
          disabled={isLoading}
          className="w-full border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition disabled:opacity-70"
        >
          Войти через Яндекс
        </button>

        <div className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            type="button"
            onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
            className="text-indigo-600 font-bold hover:underline"
          >
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};
