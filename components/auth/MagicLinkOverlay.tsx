import React, { useEffect, useMemo, useState } from 'react';
import { magicLinkService } from '../../services/magicLinkService';
import { StableStatusSlot } from '../ui/StatusNotice';

const readToken = (): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('magic_link_token')?.trim() || '';
};

const clearToken = (): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('magic_link_token');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}` || '/');
};

export const MagicLinkOverlay: React.FC = () => {
  const token = useMemo(readToken, []);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(token ? 'loading' : 'idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    magicLinkService.confirm(token)
      .then(result => {
        if (cancelled) return;
        setMessage(result);
        setStatus('success');
      })
      .catch(problem => {
        if (cancelled) return;
        setMessage(problem instanceof Error ? problem.message : 'Ссылка недействительна или уже использована.');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [token]);

  if (!token) return null;

  const finish = () => {
    clearToken();
    window.location.assign('/');
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="magic-link-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-500">AnnWord</div>
        <h1 id="magic-link-title" className="mt-2 text-2xl font-black text-indigo-950">Подтверждение входа</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
          {status === 'loading' ? 'Проверяем одноразовую ссылку и подтверждаем email…' : status === 'success' ? 'Аккаунт подтверждён.' : 'Не удалось подтвердить ссылку.'}
        </p>
        <div className="mt-4">
          <StableStatusSlot message={message} tone={status === 'success' ? 'success' : status === 'error' ? 'error' : 'info'} role={status === 'error' ? 'alert' : 'status'} />
        </div>
        {status !== 'loading' && <button type="button" onClick={finish} className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white">{status === 'success' ? 'Продолжить в AnnWord' : 'Вернуться ко входу'}</button>}
      </section>
    </div>
  );
};
