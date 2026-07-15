import React, { useEffect, useState } from 'react';
import { profileApiService } from '../services/profileApiService';
import type { UserProfile } from '../types';

interface Props {
  userProfile: UserProfile;
  premiumActive: boolean;
}

export const WeeklyReportSettingsCard: React.FC<Props> = ({ userProfile, premiumActive }) => {
  const [email, setEmail] = useState(userProfile.weeklyReportEmail || '');
  const [savedEmail, setSavedEmail] = useState(userProfile.weeklyReportEmail || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = userProfile.weeklyReportEmail || '';
    setEmail(next);
    setSavedEmail(next);
  }, [userProfile.weeklyReportEmail]);

  if (!premiumActive) {
    return <div className="mt-4 rounded-2xl bg-gray-50 p-3"><div className="text-xs font-black uppercase text-gray-400">Отчёт на почту</div><p className="mt-2 text-sm font-bold text-gray-500">Еженедельные отчёты доступны в Kids Premium.</p></div>;
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const profile = await profileApiService.updateWeeklyReportEmail(email);
      const next = profile.weeklyReportEmail || '';
      setSavedEmail(next);
      setEmail(next);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: profile }));
      setMessage(next ? 'Еженедельный отчёт включён.' : 'Еженедельный отчёт отключён.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось сохранить адрес отчёта.');
    } finally {
      setBusy(false);
    }
  };

  const changed = email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();
  return <section className="mt-4 rounded-2xl bg-indigo-50 p-3" aria-labelledby="weekly-report-title">
    <div id="weekly-report-title" className="text-xs font-black uppercase text-indigo-500">Еженедельный отчёт</div>
    <p className="mt-2 text-xs font-bold leading-relaxed text-indigo-700/80">По понедельникам пришлём игры за неделю, точность и слова, которые стоит повторить.</p>
    <label htmlFor="weekly-report-email" className="mt-3 block text-xs font-black text-indigo-900">Email в зоне .ru или .рф</label>
    <input id="weekly-report-email" type="email" value={email} onChange={event => { setEmail(event.target.value); setError(null); setMessage(null); }} placeholder="parent@example.ru" autoComplete="email" disabled={busy} className="mt-1 w-full rounded-xl border-2 border-indigo-100 bg-white px-3 py-2 text-sm font-bold text-indigo-950 outline-none focus:border-indigo-400 disabled:opacity-60" />
    {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
    {message && <p role="status" aria-live="polite" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">{message}</p>}
    <div className="mt-3 grid gap-2">
      <button type="button" onClick={() => void save()} disabled={busy || !changed} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-black text-white disabled:bg-indigo-200">{busy ? 'Сохраняю…' : savedEmail ? 'Сохранить адрес' : 'Включить отчёт'}</button>
      {savedEmail && <button type="button" onClick={() => { setEmail(''); setError(null); setMessage(null); }} disabled={busy} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700">Отключить отчёт</button>}
    </div>
  </section>;
};
