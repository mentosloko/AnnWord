import React, { useEffect, useRef, useState } from 'react';
import { legalConsentService } from '../../services/legalConsentService';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';
import { passwordResetService } from '../../services/passwordResetService';
import { StableStatusSlot } from '../ui/StatusNotice';
import { experienceUi } from '../ui/ExperiencePrimitives';

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

const LoaderIcon = () => <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>;
const RequiredMark = () => <><span aria-hidden="true" className="ml-1 text-rose-500">*</span><span className="sr-only"> Обязательное согласие.</span></>;
const legalLinkClassName = 'font-bold text-indigo-700 underline decoration-indigo-200 underline-offset-2 transition hover:text-indigo-900 hover:decoration-indigo-500';
const isRussianEmailDomain = (value: string): boolean => { const domain = value.trim().toLowerCase().split('@').pop() || ''; return domain.endsWith('.ru') || domain.endsWith('.рф') || domain.endsWith('.xn--p1ai') || domain === 'xn--p1ai'; };

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, mode, email, password, error, isLoading, onClose, onModeChange, onEmailChange, onPasswordChange, onSubmit, onYandexLogin }) => {
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
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    setTermsAccepted(false);
    setPersonalDataAccepted(false);
    setMarketingEmailsAccepted(false);
    setRecoveryMode(false);
    setRecoveryBusy(false);
    setRecoveryMessage(null);
    setRecoveryError(null);
    setShowPassword(false);
  }, [isOpen, mode]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [isOpen]);

  if (!isOpen) return null;
  const title = recoveryMode ? 'Восстановление пароля' : mode === 'login' ? 'Войти в AnnWord' : 'Создать аккаунт';
  const emailHasDomain = email.includes('@') && email.split('@').pop()!.includes('.');
  const invalidRegistrationDomain = mode === 'register' && emailHasDomain && !isRussianEmailDomain(email);
  const requiredConsentsMissing = mode === 'register' && (!termsAccepted || !personalDataAccepted);
  const authMessageIsInfo = Boolean(error && /отправлено письмо|подтверд|проверьте почту/i.test(error));
  const visibleMessage = recoveryError || recoveryMessage || (!recoveryMode ? error : null);
  const visibleTone = recoveryError ? 'error' : recoveryMessage || authMessageIsInfo ? 'info' : 'error';

  const submit = () => {
    if (invalidRegistrationDomain || requiredConsentsMissing) return;
    if (mode === 'register') legalConsentService.setRegistrationConsents({ termsAccepted, personalDataAccepted, marketingEmailsAccepted });
    onSubmit();
  };
  const requestRecovery = async (event: React.FormEvent) => {
    event.preventDefault(); setRecoveryError(null); setRecoveryMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setRecoveryError('Введите корректную электронную почту.'); return; }
    setRecoveryBusy(true);
    try { setRecoveryMessage(await passwordResetService.request(email)); }
    catch (problem) { setRecoveryError(problem instanceof Error ? problem.message : 'Не удалось отправить письмо.'); }
    finally { setRecoveryBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/55 p-3 backdrop-blur-sm" role="presentation">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" tabIndex={-1} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl outline-none sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><div className={experienceUi.eyebrow}>AnnWord</div><h2 id="auth-modal-title" className="mt-1 text-2xl font-bold text-indigo-950">{title}</h2></div><button type="button" onClick={onClose} aria-label="Закрыть окно" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl font-bold text-indigo-500">×</button></div>
      <StableStatusSlot message={visibleMessage} tone={visibleTone} role={visibleTone === 'error' ? 'alert' : 'status'} className="mt-3" />
      {recoveryMode ? <form onSubmit={requestRecovery} className="mt-2 space-y-4">
        <p className={experienceUi.body}>Укажите email аккаунта. Ссылка для смены пароля будет действовать 30 минут.</p>
        <label className="block"><span className="mb-1 block text-sm font-bold text-slate-700">Электронная почта</span><input ref={emailRef} required type="email" autoComplete="email" value={email} onChange={event => { onEmailChange(event.target.value); setRecoveryError(null); setRecoveryMessage(null); }} placeholder="user@example.ru" className="w-full rounded-xl border-2 border-slate-200 p-3 focus:border-indigo-500 focus:outline-none" /></label>
        <button type="submit" disabled={recoveryBusy} className={`flex w-full items-center justify-center gap-2 ${experienceUi.primaryButton}`}>{recoveryBusy && <LoaderIcon />}{recoveryBusy ? 'Отправляю…' : 'Отправить ссылку'}</button>
        <button type="button" disabled={recoveryBusy} onClick={() => { setRecoveryMode(false); setRecoveryMessage(null); setRecoveryError(null); }} className={`w-full ${experienceUi.secondaryButton}`}>Вернуться ко входу</button>
      </form> : <>
        <button type="button" disabled={isLoading} onClick={onYandexLogin} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-100 bg-white px-5 py-3 font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"><span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm text-white">Я</span>{mode === 'login' ? 'Продолжить через Яндекс' : 'Зарегистрироваться через Яндекс'}</button>
        <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>или по email</span><span className="h-px flex-1 bg-slate-200" /></div>
        <form onSubmit={event => { event.preventDefault(); submit(); }} className="space-y-4">
          <label className="block"><span className="mb-1 block text-sm font-bold text-slate-700">Электронная почта</span><input ref={emailRef} required type="email" autoComplete="email" value={email} onChange={event => onEmailChange(event.target.value)} placeholder="user@example.ru" aria-invalid={invalidRegistrationDomain || undefined} className={`w-full rounded-xl border-2 p-3 focus:outline-none ${invalidRegistrationDomain ? 'border-rose-300 bg-rose-50 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`} />{mode === 'register' && <span className={`mt-2 block text-xs font-medium leading-relaxed ${invalidRegistrationDomain ? 'text-rose-600' : 'text-slate-500'}`}>Используйте адрес в зоне .ru или .рф. После регистрации мы отправим письмо — аккаунт активируется после перехода по ссылке.</span>}</label>
          <label className="block"><span className="mb-1 block text-sm font-bold text-slate-700">Пароль</span><div className="relative"><input required type={showPassword ? 'text' : 'password'} minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => onPasswordChange(event.target.value)} placeholder={mode === 'login' ? 'Ваш пароль' : 'Минимум 8 символов'} className="w-full rounded-xl border-2 border-slate-200 p-3 pr-24 focus:border-indigo-500 focus:outline-none" /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-1 right-1 rounded-lg px-3 text-xs font-bold text-indigo-600">{showPassword ? 'Скрыть' : 'Показать'}</button></div>{mode === 'login' && <button type="button" disabled={isLoading} onClick={() => { setRecoveryMode(true); setRecoveryError(null); setRecoveryMessage(null); }} className="mt-2 text-sm font-bold text-indigo-600">Забыли пароль?</button>}</label>
          {mode === 'register' && <fieldset className="space-y-3 rounded-2xl bg-indigo-50/70 p-4"><legend className="px-1 text-sm font-bold text-indigo-800">Согласия</legend><label className="flex items-start gap-3 text-sm font-medium leading-5 text-slate-700"><input type="checkbox" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded" /><span>Принимаю <a href={LEGAL_DOCUMENTS.userAgreement} {...LEGAL_LINK_PROPS} className={legalLinkClassName}>Пользовательское соглашение</a>.<RequiredMark /></span></label><label className="flex items-start gap-3 text-sm font-medium leading-5 text-slate-700"><input type="checkbox" required checked={personalDataAccepted} onChange={event => setPersonalDataAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded" /><span>Согласен на <a href={LEGAL_DOCUMENTS.personalDataConsent} {...LEGAL_LINK_PROPS} className={legalLinkClassName}>обработку персональных данных</a>.<RequiredMark /></span></label><label className="flex items-start gap-3 text-sm font-medium leading-5 text-slate-700"><input type="checkbox" checked={marketingEmailsAccepted} onChange={event => setMarketingEmailsAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded" /><span>Хочу получать новости и предложения по условиям <a href={LEGAL_DOCUMENTS.marketingConsent} {...LEGAL_LINK_PROPS} className={legalLinkClassName}>согласия на рассылку</a>.</span></label></fieldset>}
          <button type="submit" disabled={isLoading || invalidRegistrationDomain || requiredConsentsMissing} className={`flex w-full items-center justify-center gap-2 ${experienceUi.primaryButton}`}>{isLoading && <LoaderIcon />}{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
        </form>
        <button type="button" disabled={isLoading} onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')} className="mt-4 w-full text-sm font-bold text-indigo-600">{mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}</button>
      </>}
    </div>
  </div>;
};
