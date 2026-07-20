import React, { useEffect, useRef, useState } from 'react';
import { legalConsentService } from '../../services/legalConsentService';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';
import { passwordResetService } from '../../services/passwordResetService';
import { magicLinkService } from '../../services/magicLinkService';
import { StableStatusSlot } from '../ui/StatusNotice';

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

const RequiredMark = () => <><span aria-hidden="true" className="ml-1 text-rose-500">*</span><span className="sr-only"> Обязательное согласие.</span></>;

const isRussianEmailDomain = (value: string): boolean => {
  const domain = value.trim().toLowerCase().split('@').pop() || '';
  return domain.endsWith('.ru') || domain.endsWith('.рф') || domain.endsWith('.xn--p1ai') || domain === 'xn--p1ai';
};

const legalLinkClassName = 'font-black text-indigo-700 underline decoration-indigo-200 underline-offset-2 transition hover:text-indigo-900 hover:decoration-indigo-500';

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false);
  const [marketingEmailsAccepted, setMarketingEmailsAccepted] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    setTermsAccepted(false);
    setPersonalDataAccepted(false);
    setMarketingEmailsAccepted(false);
    setRecoveryMode(false);
    setRecoveryBusy(false);
    setRecoveryMessage(null);
    setRecoveryError(null);
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable: HTMLElement[] = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
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
  const title = recoveryMode ? 'Восстановление пароля' : mode === 'login' ? 'Вход' : 'Регистрация';
  const emailHasDomain = email.includes('@') && email.split('@').pop()!.includes('.');
  const invalidRegistrationDomain = mode === 'register' && emailHasDomain && !isRussianEmailDomain(email);
  const requiredConsentsMissing = mode === 'register' && (!termsAccepted || !personalDataAccepted);
  const authMessageIsInfo = Boolean(error && /magic link|отправлено письмо|подтверд/i.test(error));
  const visibleMessage = recoveryError || recoveryMessage || (!recoveryMode ? error : null);
  const visibleTone = recoveryError ? 'error' : recoveryMessage || authMessageIsInfo ? 'info' : 'error';

  const submit = () => {
    if (invalidRegistrationDomain || requiredConsentsMissing) return;
    if (mode === 'register') {
      legalConsentService.setRegistrationConsents({ termsAccepted, personalDataAccepted, marketingEmailsAccepted });
    }
    onSubmit();
  };

  const requestRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setRecoveryError('Введите корректную электронную почту.');
      return;
    }
    setRecoveryBusy(true);
    try {
      setRecoveryMessage(await passwordResetService.request(email));
    } catch (problem) {
      setRecoveryError(problem instanceof Error ? problem.message : 'Не удалось отправить письмо.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  const requestMagicLogin = async () => {
    setRecoveryError(null);
    setRecoveryMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setRecoveryError('Введите email, чтобы получить magic link.');
      return;
    }
    setRecoveryBusy(true);
    try {
      setRecoveryMessage(await magicLinkService.request(email));
    } catch (problem) {
      setRecoveryError(problem instanceof Error ? problem.message : 'Не удалось отправить magic link.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" aria-describedby={error || recoveryError ? 'auth-modal-error' : undefined} tabIndex={-1} className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl outline-none animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h3 id="auth-modal-title" className="text-xl font-bold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть окно входа" className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600">×</button>
        </div>

        <StableStatusSlot message={visibleMessage} tone={visibleTone} role={visibleTone === 'error' ? 'alert' : 'status'} className="mb-1" />

        {recoveryMode ? (
          <form onSubmit={requestRecovery} className="space-y-4">
            <p className="text-sm font-semibold leading-relaxed text-slate-600">Укажите email аккаунта. Мы отправим одноразовую ссылку, которая действует 30 минут.</p>
            <div>
              <label htmlFor="recovery-email" className="mb-1 block text-xs font-bold uppercase text-gray-500">Электронная почта</label>
              <input ref={emailRef} id="recovery-email" required type="email" autoComplete="email" value={email} onChange={(event) => { onEmailChange(event.target.value); setRecoveryError(null); setRecoveryMessage(null); }} placeholder="user@example.ru" className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none" />
            </div>
            <button type="submit" disabled={recoveryBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">{recoveryBusy && <LoaderIcon />}{recoveryBusy ? 'Отправляю…' : 'Отправить ссылку'}</button>
            <button type="button" disabled={recoveryBusy} onClick={() => { setRecoveryMode(false); setRecoveryMessage(null); setRecoveryError(null); }} className="w-full text-sm font-bold text-indigo-600">← Вернуться ко входу</button>
          </form>
        ) : (
          <>
            <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className="mb-1 block text-xs font-bold uppercase text-gray-500">Электронная почта</label>
                <input ref={emailRef} id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="user@example.ru" aria-invalid={invalidRegistrationDomain || undefined} aria-describedby={mode === 'register' ? 'registration-domain-hint' : undefined} className={`w-full rounded-lg border-2 p-3 transition focus:outline-none ${invalidRegistrationDomain ? 'border-rose-300 bg-rose-50 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'}`} />
                {mode === 'register' && <p id="registration-domain-hint" className={`mt-2 text-xs font-bold leading-relaxed ${invalidRegistrationDomain ? 'text-rose-600' : 'text-gray-500'}`}>Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. После отправки формы откройте письмо и подтвердите адрес — до этого войти в аккаунт нельзя.</p>}
              </div>
              <div>
                <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase text-gray-500">Пароль</label>
                <input id="auth-password" required type="password" minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={mode === 'login' ? 'ваш пароль' : 'минимум 8 символов'} className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none" />
                {mode === 'login' && <button type="button" disabled={isLoading} onClick={() => { setRecoveryMode(true); setRecoveryError(null); setRecoveryMessage(null); }} className="mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800">Забыли пароль?</button>}
              </div>

              {mode === 'register' && (
                <fieldset className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <legend className="px-1 text-xs font-black uppercase tracking-wider text-indigo-700">Согласия</legend>
                  <div className="flex items-start gap-3 text-sm font-semibold leading-5 text-slate-700">
                    <input id="accept-user-agreement" type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="accept-user-agreement" className="cursor-pointer">Я принимаю <a href={LEGAL_DOCUMENTS.userAgreement} {...LEGAL_LINK_PROPS} className={legalLinkClassName}>Пользовательское соглашение</a>.<RequiredMark /></label>
                  </div>
                  <div className="flex items-start gap-3 text-sm font-semibold leading-5 text-slate-700">
                    <input id="accept-personal-data" type="checkbox" required checked={personalDataAccepted} onChange={(event) => setPersonalDataAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="accept-personal-data" className="cursor-pointer">Я даю согласие на обработку моих персональных данных в соответствии с <a href={LEGAL_DOCUMENTS.personalDataConsent} {...LEGAL_LINK_PROPS} className={legalLinkClassName}>Согласием на обработку персональных данных</a>.<RequiredMark /></label>
                  </div>
                  <div className="flex items-start gap-3 text-sm font-semibold leading-5 text-slate-700">
                    <input id="accept-marketing" type="checkbox" checked={marketingEmailsAccepted} onChange={(event) => setMarketingEmailsAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="accept-marketing" className="cursor-pointer">Я согласен получать новости, специальные предложения и рекламные сообщения AnnWord по электронной почте на условиях <a href={LEGAL_DOCUMENTS.marketingConsent} {...LEGAL_LINK_PROPS} className={legalLinkClassName}>Согласия на рассылку</a>.</label>
                  </div>
                </fieldset>
              )}

              <button type="submit" disabled={isLoading || invalidRegistrationDomain || requiredConsentsMissing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{isLoading && <LoaderIcon />}{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
            </form>
            {mode === 'login' && <button type="button" disabled={isLoading || recoveryBusy} onClick={() => void requestMagicLogin()} className="mt-3 w-full rounded-xl border-2 border-purple-100 bg-purple-50 p-3 font-bold text-purple-700 transition hover:bg-purple-100 disabled:cursor-wait disabled:opacity-70">{recoveryBusy ? 'Отправляю ссылку…' : 'Войти по magic link'}</button>}<button type="button" disabled={isLoading} onClick={onYandexLogin} className="mt-3 w-full rounded-xl border-2 border-red-100 bg-white p-3 font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-70">{mode === 'login' ? 'Войти через Яндекс' : 'Зарегистрироваться через Яндекс'}</button>
            <button type="button" disabled={isLoading} onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')} className="mt-4 w-full text-sm font-bold text-indigo-600 hover:text-indigo-800">{mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}</button>
          </>
        )}
      </div>
    </div>
  );
};
