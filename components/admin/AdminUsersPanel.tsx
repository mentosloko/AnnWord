import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminUsersService, type AdminUserSummary } from '../../services/adminUsersService';

const PAGE_SIZE = 50;

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date);
};

const roleLabel = (user: AdminUserSummary): string => {
  if (user.role === 'admin') return 'Администратор';
  if (user.role === 'teacher' || user.accountMode === 'teacher') return 'Преподаватель';
  if (user.role === 'parent' || user.accountMode === 'parent') return 'Родитель';
  if (user.accountMode === 'player') return 'Игрок';
  return 'Пользователь';
};

const providerLabel = (provider: AdminUserSummary['provider']): string => provider === 'yandex' ? 'Яндекс' : 'Email';

const premiumLabel = (user: AdminUserSummary): string => {
  if (user.role === 'admin') return 'Admin';
  if (!user.premiumActive) return 'Free';
  return user.premiumExpiresAt ? `Premium до ${formatDate(user.premiumExpiresAt)}` : 'Premium';
};

const displayName = (user: AdminUserSummary): string => user.fullName || user.username || 'Без имени';

export const AdminUsersPanel: React.FC = () => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, targetSearch: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminUsersService.list({
        search: targetSearch,
        page: targetPage,
        pageSize: PAGE_SIZE,
        signal,
      });
      setUsers(result.users);
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователей.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(1, '', controller.signal);
    return () => controller.abort();
  }, [load]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextSearch = draftSearch.trim();
    setSearch(nextSearch);
    void load(1, nextSearch);
  };

  const clearSearch = () => {
    setDraftSearch('');
    setSearch('');
    void load(1, '');
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || loading) return;
    void load(nextPage, search);
  };

  return (
    <section className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-indigo-500">Администратор · аккаунты</div>
          <h2 className="mt-1 text-2xl font-black text-indigo-950">Пользователи</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
            Все зарегистрированные аккаунты AnnWord. Поиск работает по email, имени аккаунта и имени ребёнка.
          </p>
        </div>
        <div className="w-max rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
          Всего: {total}
        </div>
      </div>

      <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Поиск пользователей</span>
          <input
            type="search"
            value={draftSearch}
            onChange={event => setDraftSearch(event.target.value)}
            placeholder="Email, имя аккаунта или ребёнка"
            autoComplete="off"
            maxLength={100}
            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-semibold text-indigo-950 outline-none transition focus:border-indigo-300 focus:bg-white"
          />
        </label>
        <div className="flex gap-2">
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              disabled={loading}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 sm:flex-none"
            >
              Сбросить
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            {loading ? 'Загружаю…' : 'Найти'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      )}

      {!error && loading && users.length === 0 && (
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">Загружаю аккаунты…</div>
      )}

      {!error && !loading && users.length === 0 && (
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">Ничего не найдено.</div>
      )}

      {users.length > 0 && (
        <>
          <div className="mt-5 space-y-3 md:hidden">
            {users.map(user => (
              <article key={user.id} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-black text-indigo-950">{displayName(user)}</div>
                    <div className="mt-1 break-all text-sm font-semibold text-slate-600">{user.email}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-slate-200">
                    {roleLabel(user)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Ребёнок</div>
                    <div className="mt-1 truncate font-semibold text-slate-700">{user.childDisplayName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Вход</div>
                    <div className="mt-1 font-semibold text-slate-700">{providerLabel(user.provider)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Доступ</div>
                    <div className="mt-1 break-words font-semibold text-slate-700">{premiumLabel(user)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Регистрация</div>
                    <div className="mt-1 font-semibold text-slate-700">{formatDate(user.createdAt)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-100 md:block">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Аккаунт</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Ребёнок</th>
                  <th className="px-4 py-3">Вход</th>
                  <th className="px-4 py-3">Доступ</th>
                  <th className="px-4 py-3">Регистрация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map(user => (
                  <tr key={user.id} className="align-top">
                    <td className="max-w-xs px-4 py-3">
                      <div className="truncate font-black text-indigo-950">{displayName(user)}</div>
                      <div className="mt-1 break-all text-xs font-semibold text-slate-500">{user.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{roleLabel(user)}</td>
                    <td className="max-w-48 px-4 py-3 font-semibold text-slate-700">{user.childDisplayName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{providerLabel(user.provider)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{premiumLabel(user)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => changePage(page - 1)}
            disabled={page <= 1 || loading}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Назад
          </button>
          <div className="text-center text-sm font-bold text-slate-500">
            {page} из {totalPages}
          </div>
          <button
            type="button"
            onClick={() => changePage(page + 1)}
            disabled={page >= totalPages || loading}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Дальше
          </button>
        </div>
      )}
    </section>
  );
};
