import React, { useEffect, useRef } from 'react';

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
  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const title = mode === 'login' ? 'Вход' : 'Регистрация';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby={error ? 'auth-modal-error' : undefined}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl outline-none animate-fade-in"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="auth-modal-title" className="text-xl font-bold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть окно входа" className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600">×</button>
        </div>

        {error && (
          <div id="auth-modal-error" className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600" role="alert">
            ⚠️ {error}
          </div>
        )}

        <form
          onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-bold uppercase text-gray-500">Электронная почта</label>
            <input
              ref={emailRef}
              id="auth-email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase text-gray-500">Пароль</label>
            <input
              id="auth-password"
              required
              minLength={6}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-70">
            {isLoading ? <LoaderIcon /> : null}
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200" /><span className="text-xs font-bold uppercase text-gray-400">или</span><div className="h-px flex-1 bg-gray-200" /></div>
        <button type="button" onClick={onYandexLogin} disabled={isLoading} className="w-full rounded-xl border-2 border-gray-200 py-3 font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70">Продолжить через Яндекс</button>
        <p className="mt-2 text-center text-xs font-bold text-gray-400">Откроется страница Яндекса для безопасного входа.</p>

        <div className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button type="button" onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')} className="font-bold text-indigo-600 hover:underline">
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};
