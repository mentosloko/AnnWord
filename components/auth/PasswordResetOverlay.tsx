import React, { useMemo, useState } from 'react';
import { passwordResetService } from '../../services/passwordResetService';
import { StableStatusSlot } from '../ui/StatusNotice';

const readResetToken = (): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('password_reset_token')?.trim() || '';
};

const clearResetToken = (): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('password_reset_token');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}` || '/');
};

export const PasswordResetOverlay: React.FC = () => {
  const token = useMemo(readResetToken, []);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!token) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Пароль должен быть не короче 8 символов.'); return; }
    if (password !== confirmation) { setError('Пароли не совпадают.'); return; }
    setBusy(true);
    try {
      const message = await passwordResetService.confirm(token, password);
      setSuccess(message);
      setPassword('');
      setConfirmation('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось изменить пароль.');
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    clearResetToken();
    window.location.assign('/');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="password-reset-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-500">AnnWord</div>
        <h1 id="password-reset-title" className="mt-2 text-2xl font-black text-indigo-950">Новый пароль</h1>
        {success ? (
          <div className="mt-5">
            <p role="status" className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-800">{success}</p>
            <button type="button" onClick={finish} className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white">Перейти ко входу</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reset-password" className="mb-1 block text-xs font-black uppercase text-slate-500">Новый пароль</label>
              <input id="reset-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={event => { setPassword(event.target.value); setError(null); }} className="w-full rounded-xl border-2 border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label htmlFor="reset-password-confirm" className="mb-1 block text-xs font-black uppercase text-slate-500">Повторите пароль</label>
              <input id="reset-password-confirm" type="password" minLength={8} required autoComplete="new-password" value={confirmation} onChange={event => { setConfirmation(event.target.value); setError(null); }} className="w-full rounded-xl border-2 border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </div>
            <StableStatusSlot message={error} tone="error" role="alert" />
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60">{busy ? 'Сохраняю…' : 'Сохранить новый пароль'}</button>
          </form>
        )}
      </section>
    </div>
  );
};
