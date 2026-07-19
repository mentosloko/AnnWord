import React, { useEffect, useState } from 'react';
import { profileApiService } from '../services/profileApiService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ParentContactEmailCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void profileApiService.getParentContactEmail()
      .then(result => {
        if (!active) return;
        const next = result.email || '';
        setEmail(next);
        setSavedEmail(next);
      })
      .catch(problem => {
        if (active) setError(problem instanceof Error ? problem.message : 'Не удалось загрузить email родителя.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (nextValue: string) => {
    const normalized = nextValue.trim().toLowerCase();
    setError(null);
    setMessage(null);
    if (normalized && !EMAIL_PATTERN.test(normalized)) {
      setError('Введите корректный email родителя.');
      return;
    }
    setBusy(true);
    try {
      const result = await profileApiService.updateParentContactEmail(normalized);
      const next = result.email || '';
      setEmail(next);
      setSavedEmail(next);
      setMessage(next ? 'Контактный email сохранён.' : 'Контактный email удалён.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('annword:parent-email-updated', { detail: { email: next || null } }));
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось сохранить email родителя.');
    } finally {
      setBusy(false);
    }
  };

  const changed = email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();
  const statusLabel = loading ? 'проверяем' : error && !savedEmail ? 'не загружен' : savedEmail ? 'указан' : 'не указан';
  const statusClass = loading
    ? 'bg-white text-sky-600'
    : error && !savedEmail
      ? 'bg-rose-100 text-rose-700'
      : savedEmail
        ? 'bg-green-100 text-green-700'
        : 'bg-white text-slate-500';

  return <section className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-3" aria-labelledby="parent-contact-email-title">
    <div className="flex items-center justify-between gap-2">
      <div id="parent-contact-email-title" className="text-xs font-black uppercase text-sky-600">Email родителя</div>
      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${statusClass}`}>{statusLabel}</span>
    </div>
    <p className="mt-2 text-xs font-bold leading-relaxed text-sky-900/75">Контактный адрес взрослого. Он не меняет email для входа и может использоваться для отчётов и важных уведомлений.</p>
    <label htmlFor="parent-contact-email" className="mt-3 block text-xs font-black text-sky-950">Электронная почта</label>
    <input id="parent-contact-email" type="email" value={email} onChange={event => { setEmail(event.target.value); setError(null); setMessage(null); }} placeholder="parent@example.ru" autoComplete="email" disabled={loading || busy} className="mt-1 w-full rounded-xl border-2 border-sky-100 bg-white px-3 py-2 text-sm font-bold text-sky-950 outline-none focus:border-sky-400 disabled:opacity-60" />
    {loading && <p role="status" aria-live="polite" className="mt-2 text-xs font-bold text-sky-700">Загружаю настройку…</p>}
    {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
    {message && <p role="status" aria-live="polite" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">{message}</p>}
    <div className="mt-3 grid gap-2">
      <button type="button" onClick={() => void save(email)} disabled={loading || busy || !changed || !email.trim()} className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-black text-white disabled:bg-sky-200">{busy ? 'Сохраняю…' : savedEmail ? 'Сохранить изменения' : 'Сохранить email'}</button>
      {savedEmail && <button type="button" onClick={() => void save('')} disabled={busy} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-sky-700">Удалить email</button>}
    </div>
  </section>;
};
