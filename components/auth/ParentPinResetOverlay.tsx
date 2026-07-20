import React, { useMemo, useState } from 'react';
import { parentPinResetService } from '../../services/parentPinResetService';
import { StableStatusSlot } from '../ui/StatusNotice';

const readToken = (): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('parent_pin_reset_token')?.trim() || '';
};

const clearToken = (): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('parent_pin_reset_token');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}` || '/');
};

const onlyDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export const ParentPinResetOverlay: React.FC = () => {
  const token = useMemo(readToken, []);
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!token) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) { setError('PIN должен состоять из 4 цифр.'); return; }
    if (pin !== confirmation) { setError('PIN и повтор PIN не совпадают.'); return; }
    setBusy(true);
    try {
      setSuccess(await parentPinResetService.confirm(token, pin));
      setPin('');
      setConfirmation('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось изменить PIN.');
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    clearToken();
    window.location.assign('/');
  };

  return (
    <div className="fixed inset-0 z-[76] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="parent-pin-reset-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-widest text-purple-500">AnnWord Kids</div>
        <h1 id="parent-pin-reset-title" className="mt-2 text-2xl font-black text-indigo-950">Новый родительский PIN</h1>
        {success ? (
          <div className="mt-5">
            <StableStatusSlot message={success} tone="success" />
            <button type="button" onClick={finish} className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white">Вернуться в AnnWord</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="new-parent-pin" className="mb-1 block text-xs font-black uppercase text-slate-500">Новый PIN</label>
              <input id="new-parent-pin" value={pin} onChange={event => { setPin(onlyDigits(event.target.value)); setError(null); }} type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} required placeholder="••••" className="w-full rounded-xl border-2 border-slate-200 p-3 text-center text-xl font-black outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label htmlFor="new-parent-pin-confirm" className="mb-1 block text-xs font-black uppercase text-slate-500">Повторите PIN</label>
              <input id="new-parent-pin-confirm" value={confirmation} onChange={event => { setConfirmation(onlyDigits(event.target.value)); setError(null); }} type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} required placeholder="••••" className="w-full rounded-xl border-2 border-slate-200 p-3 text-center text-xl font-black outline-none focus:border-indigo-500" />
            </div>
            <StableStatusSlot message={error} tone="error" role="alert" />
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60">{busy ? 'Сохраняю…' : 'Сохранить новый PIN'}</button>
          </form>
        )}
      </section>
    </div>
  );
};
