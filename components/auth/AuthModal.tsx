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

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, mode, email, password, error, isLoading, onClose, onModeChange, onEmailChange, onPasswordChange, onSubmit, onYandexLogin }) => {
  if (!isOpen) return null;
  const isLogin = mode === 'login';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" aria-describedby={error ? 'auth-modal-error' : undefined} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl outline-none animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h3 id="auth-modal-title" className="text-xl font-bold text-gray-800">{isLogin ? 'Вход' : 'Регистрация'}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть окно входа" className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600">×</button>
        </div>
        {error && <div id="auth-modal-error" className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600" role="alert">⚠️ {error}</div>}
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-bold uppercase text-gray-500">Электронная почта</label>
            <input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="user@example.com" className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase text-gray-500">Пароль</label>
            <input id="auth-password" required minLength={6} type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Пароль" className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-70">{isLogin ? 'Войти' : 'Создать аккаунт'}</button>
        </form>
        <div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200" /><span className="text-xs font-bold uppercase text-gray-400">или</span><div className="h-px flex-1 bg-gray-200" /></div>
        <button type="button" onClick={onYandexLogin} disabled={isLoading} className="w-full rounded-xl border-2 border-gray-200 py-3 font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70">Продолжить через Яндекс</button>
        <p className="mt-2 text-center text-xs font-bold text-gray-400">Откроется страница Яндекса для безопасного входа.</p>
        <div className="mt-6 text-center text-sm text-gray-500">{isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'} <button type="button" onClick={() => onModeChange(isLogin ? 'register' : 'login')} className="font-bold text-indigo-600 hover:underline">{isLogin ? 'Зарегистрироваться' : 'Войти'}</button></div>
      </div>
    </div>
  );
};
