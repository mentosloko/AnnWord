import React, { useEffect, useState } from 'react';
import { profileApiService, type WeeklyReportPreferenceStatus } from '../services/profileApiService';
import type { UserProfile } from '../types';
import { useProfileFreshness } from '../hooks/useProfileFreshness';

interface Props {
  userProfile: UserProfile;
  premiumActive: boolean;
}

const formatDate = (value?: string | null): string => value
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const deliveryLabel: Record<string, string> = {
  processing: 'Готовится',
  sent: 'Отправлен',
  failed: 'Ошибка отправки',
};

export const WeeklyReportSettingsCard: React.FC<Props> = ({ userProfile, premiumActive }) => {
  const profileFreshness = useProfileFreshness();
  const premiumChecking = !premiumActive && profileFreshness !== 'fresh';
  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState<WeeklyReportPreferenceStatus | null>(null);
  const [enabled, setEnabled] = useState(Boolean(userProfile.weeklyReportEmail));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    if (!premiumActive) { setStatus(null); return; }
    setStatusLoading(true);
    try {
      const next = await profileApiService.getWeeklyReportEmailStatus();
      setStatus(next);
      setEnabled(next.enabled);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { setEnabled(Boolean(userProfile.weeklyReportEmail)); }, [userProfile.weeklyReportEmail]);
  useEffect(() => { void loadStatus(); }, [premiumActive, userProfile.weeklyReportEmail]);

  const toggleReport = async (nextEnabled: boolean) => {
    const accountEmail = status?.accountEmail?.trim() || '';
    setError(null);
    setMessage(null);
    if (nextEnabled && !accountEmail) {
      setError('В аккаунте не указан email для отправки отчёта.');
      return;
    }
    setBusy(true);
    try {
      const profile = await profileApiService.updateWeeklyReportEmail(nextEnabled ? accountEmail : '');
      setEnabled(nextEnabled);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: profile }));
      setMessage(nextEnabled ? 'Еженедельный отчёт включён.' : 'Еженедельный отчёт отключён.');
      await loadStatus();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось изменить настройку отчёта.');
    } finally {
      setBusy(false);
    }
  };

  if (premiumChecking) return <div className="rounded-2xl bg-indigo-50 p-4" role="status" aria-live="polite"><div className="text-xs font-black uppercase text-indigo-500">Еженедельный отчёт</div><p className="mt-2 text-sm font-bold text-indigo-700">Проверяем доступ и сохранённую настройку…</p></div>;
  if (!premiumActive) return <div className="rounded-2xl bg-gray-50 p-4"><div className="text-xs font-black uppercase text-gray-400">Отчёт на почту</div><p className="mt-2 text-sm font-bold text-gray-500">Еженедельные отчёты доступны в Kids Premium.</p></div>;

  const latest = status?.latestDelivery;
  const accountEmail = status?.accountEmail || '';
  return <section className="rounded-2xl bg-indigo-50 p-4" aria-labelledby="weekly-report-title">
    <div className="flex items-start justify-between gap-3">
      <div><div id="weekly-report-title" className="text-xs font-black uppercase text-indigo-500">Еженедельный отчёт</div><p className="mt-2 text-sm font-bold leading-relaxed text-indigo-900">Получать краткий отчёт о тренировках ребёнка на почту аккаунта.</p></div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${enabled ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500'}`}>{enabled ? 'включён' : 'выключен'}</span>
    </div>
    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3">
      <input type="checkbox" checked={enabled} disabled={busy || statusLoading || !accountEmail} onChange={event => void toggleReport(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded" />
      <span className="min-w-0"><span className="block text-sm font-black text-indigo-950">Отправлять отчёт по понедельникам</span><span className="mt-1 block break-all text-xs font-bold text-indigo-500">{statusLoading ? 'Проверяем email аккаунта…' : accountEmail || 'Email аккаунта недоступен'}</span></span>
    </label>
    <p className="mt-3 text-xs font-bold leading-relaxed text-indigo-700/80">В отчёте будут игры за неделю, точность и слова, которые стоит повторить.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
    {message && <p role="status" aria-live="polite" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">{message}</p>}
    {enabled && <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs font-bold text-indigo-800">
      {statusLoading ? 'Проверяю последнюю отправку…' : latest ? <><div className="flex items-center justify-between gap-2"><span>Последний отчёт</span><span className={latest.status === 'failed' ? 'text-rose-700' : latest.status === 'sent' ? 'text-green-700' : 'text-amber-700'}>{deliveryLabel[latest.status]}</span></div><div className="mt-1 text-indigo-500">{formatDate(latest.sentAt || latest.attemptedAt)}</div>{latest.status === 'failed' && <div className="mt-2 rounded-lg bg-rose-50 p-2 text-rose-700">Следующая попытка будет при очередном запуске отчётов.</div>}</> : 'Отчёты ещё не отправлялись.'}
    </div>}
  </section>;
};
