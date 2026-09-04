import React, { FormEvent, useMemo, useState } from 'react';
import { adminPremiumService, type AdminPremiumUser } from '../../services/adminPremiumService';

const PRESET_DAYS = [7, 31, 90, 365] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return 'без срока';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const roleLabel = (user: AdminPremiumUser): string => {
  if (user.role === 'parent' || user.accountMode === 'parent') return 'Родитель / Kids';
  if (user.role === 'teacher' || user.accountMode === 'teacher') return 'Преподаватель';
  if (user.role === 'admin') return 'Администратор';
  return 'Пользователь';
};

const previewExpiresAt = (user: AdminPremiumUser | null, days: number): string | null => {
  if (!user) return null;
  const existing = user.premiumActive && user.premiumExpiresAt ? Date.parse(user.premiumExpiresAt) : Number.NaN;
  const base = Number.isFinite(existing) && existing > Date.now() ? existing : Date.now();
  return new Date(base + days * DAY_MS).toISOString();
};

export const AdminPremiumGiftPanel: React.FC = () => {
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<AdminPremiumUser | null>(null);
  const [days, setDays] = useState(31);
  const [note, setNote] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [grantLoading, setGrantLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const preview = useMemo(() => previewExpiresAt(user, days), [user, days]);

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) return;
    setLookupLoading(true);
    setError(null);
    setSuccess(null);
    setConfirming(false);
    try {
      const found = await adminPremiumService.findUserByEmail(targetEmail);
      setUser(found);
    } catch (lookupError) {
      setUser(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Не удалось найти пользователя.');
    } finally {
      setLookupLoading(false);
    }
  };

  const grant = async () => {
    if (!user || grantLoading) return;
    setGrantLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminPremiumService.grantPremium(user.id, days, note);
      setUser(result.user);
      setSuccess(`Готово: ${result.user.email} — Premium до ${formatDateTime(result.premiumExpiresAt)}.`);
      setConfirming(false);
      setNote('');
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : 'Не удалось выдать Premium.');
    } finally {
      setGrantLoading(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Администратор · Premium</div>
          <h2 className="mt-1 text-2xl font-black text-indigo-950">Подарочный Premium</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
            Найдите аккаунт по точному email и бесплатно добавьте дни Premium. Если Premium уже активен, дни прибавятся к текущему сроку, а не заменят его.
          </p>
        </div>
        <div className="w-max rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Каждая выдача записывается</div>
      </div>

      <form onSubmit={lookup} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Email пользователя</span>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="friend@example.ru"
            autoComplete="off"
            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-semibold text-indigo-950 outline-none transition focus:border-indigo-300 focus:bg-white"
          />
        </label>
        <button
          type="submit"
          disabled={lookupLoading || !email.trim()}
          className="rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lookupLoading ? 'Ищу…' : 'Найти пользователя'}
        </button>
      </form>

      {error && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
      {success && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div>}

      {user && (
        <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-indigo-950">{user.username || 'Без имени'}</div>
              <div className="mt-1 break-all text-sm font-semibold text-slate-600">{user.email}</div>
              <div className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">{roleLabel(user)}</div>
            </div>
            <div className={`w-max rounded-full px-3 py-1.5 text-sm font-bold ${user.premiumActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {user.premiumActive ? `Premium до ${formatDateTime(user.premiumExpiresAt)}` : 'Premium не активен'}
            </div>
          </div>

          {user.role === 'admin' ? (
            <div className="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">Администратору Premium доступен автоматически, подарок не требуется.</div>
          ) : (
            <>
              <div className="mt-5">
                <div className="text-sm font-black text-indigo-950">На сколько продлить</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESET_DAYS.map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setDays(value); setConfirming(false); }}
                      className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${days === value ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 ring-1 ring-slate-200 hover:bg-indigo-50'}`}
                    >
                      +{value} {value === 31 ? 'день' : value === 365 ? 'дней' : 'дней'}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <span className="text-xs font-bold text-slate-500">свой срок</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={days}
                      onChange={event => {
                        const value = Math.min(365, Math.max(1, Number(event.target.value) || 1));
                        setDays(Math.round(value));
                        setConfirming(false);
                      }}
                      className="w-16 bg-transparent text-right text-sm font-black text-indigo-950 outline-none"
                    />
                  </label>
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-sm font-black text-indigo-950">Комментарий <span className="font-medium text-slate-400">(необязательно)</span></span>
                <input
                  type="text"
                  maxLength={300}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Например: тестовая группа, подарок другу"
                  className="mt-2 w-full rounded-2xl border-2 border-slate-100 bg-white px-4 py-3 text-sm font-semibold text-indigo-950 outline-none transition focus:border-indigo-300"
                />
              </label>

              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">После выдачи</div>
                <div className="mt-1 font-black text-indigo-950">Ориентировочно до {formatDateTime(preview)}</div>
                <p className="mt-1 text-xs font-medium text-slate-500">Точный срок рассчитывает сервер от текущей даты или от конца уже активного Premium — что позже.</p>
              </div>

              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="mt-4 w-full rounded-2xl bg-amber-500 px-5 py-3.5 font-black text-amber-950 transition hover:bg-amber-400"
                >
                  {user.premiumActive ? `Продлить Premium на ${days} дн.` : `Подарить Premium на ${days} дн.`}
                </button>
              ) : (
                <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                  <div className="font-black text-amber-950">Подтвердить бесплатную выдачу?</div>
                  <p className="mt-1 text-sm font-medium text-amber-800">{user.email} получит +{days} дн. Premium. Это действие попадёт в журнал администратора.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => setConfirming(false)} disabled={grantLoading} className="rounded-xl bg-white px-4 py-2.5 font-bold text-slate-600 ring-1 ring-amber-200">Отмена</button>
                    <button type="button" onClick={grant} disabled={grantLoading} className="rounded-xl bg-amber-500 px-4 py-2.5 font-black text-amber-950 disabled:opacity-50">{grantLoading ? 'Выдаю…' : 'Да, выдать Premium'}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
