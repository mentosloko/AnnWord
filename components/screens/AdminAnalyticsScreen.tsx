import React, { useEffect, useMemo, useState } from 'react';
import { adminAnalyticsService, AdminAnalyticsSnapshot } from '../../services/adminAnalyticsService';
import { UserProfile } from '../../types';

interface AdminAnalyticsScreenProps {
  userProfile: UserProfile;
  onBackHome: () => void;
}

const formatGameType = (type: string | null): string => {
  switch (type) {
    case 'wordle': return 'Wordle';
    case 'hangman': return 'Виселица';
    case 'sprint': return 'Спринт';
    case 'anagram': return 'Анаграммы';
    case 'memory': return 'Память';
    default: return type || 'Другое';
  }
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

const StatCard: React.FC<{ label: string; value: number | string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
    <div className="text-xs font-black uppercase tracking-widest text-indigo-300">{label}</div>
    <div className="mt-2 text-3xl font-black text-indigo-950">{value}</div>
    {hint && <div className="mt-1 text-xs font-semibold text-gray-400">{hint}</div>}
  </div>
);

export const AdminAnalyticsScreen: React.FC<AdminAnalyticsScreenProps> = ({ userProfile, onBackHome }) => {
  const [snapshot, setSnapshot] = useState<AdminAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    adminAnalyticsService.loadSnapshot()
      .then(data => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Не удалось загрузить аналитику');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const totals = useMemo(() => {
    const gameRows = snapshot?.gameStats || [];
    const economyRows = snapshot?.economyStats || [];
    return {
      gamesStarted: gameRows.reduce((sum, row) => sum + row.games_started, 0),
      gamesFinished: gameRows.reduce((sum, row) => sum + row.games_finished, 0),
      gamesWon: gameRows.reduce((sum, row) => sum + row.games_won, 0),
      uniqueUsers: Math.max(0, ...gameRows.map(row => row.unique_users), 0),
      coinsEarned: economyRows.reduce((sum, row) => sum + row.coins_earned, 0),
      coinsSpent: economyRows.reduce((sum, row) => sum + row.coins_spent, 0),
      purchases: economyRows.reduce((sum, row) => sum + row.purchases, 0),
      itemsUsed: economyRows.reduce((sum, row) => sum + row.items_used, 0),
    };
  }, [snapshot]);

  const unsupportedWordsCount = useMemo(() =>
    (snapshot?.unsupportedDictionaryWords || []).reduce((sum, row) => sum + row.words.length, 0),
  [snapshot]);

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl border border-indigo-100">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-2xl font-black text-indigo-950">Раздел только для администратора</h1>
          <p className="mt-2 text-gray-500">У текущего профиля нет доступа к аналитике.</p>
          <button onClick={onBackHome} className="mt-6 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">На главную</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.25em] text-indigo-300">Admin dashboard</div>
          <h1 className="mt-2 text-3xl font-black text-indigo-950 sm:text-4xl">Аналитика AnnWord</h1>
          <p className="mt-2 text-sm font-semibold text-gray-500">Игры, награды, покупки, предметы и словари пользователей.</p>
        </div>
        <button onClick={onBackHome} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-sm border border-indigo-100 hover:bg-indigo-50">
          На главную
        </button>
      </div>

      {isLoading && (
        <div className="rounded-3xl border border-indigo-100 bg-white p-8 text-center font-bold text-indigo-700 shadow-sm">Загружаю аналитику...</div>
      )}

      {error && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 font-bold text-red-700">{error}</div>
      )}

      {!isLoading && !error && snapshot && (
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Стартов игр" value={totals.gamesStarted} hint="по последним 30 строкам витрины" />
            <StatCard label="Завершений" value={totals.gamesFinished} />
            <StatCard label="Побед" value={totals.gamesWon} />
            <StatCard label="Монет потрачено" value={totals.coinsSpent} hint={`${totals.purchases} покупок`} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-indigo-950">Игры по дням</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-widest text-indigo-300">
                    <tr>
                      <th className="py-3">Дата</th>
                      <th>Режим</th>
                      <th>Старт</th>
                      <th>Финиш</th>
                      <th>Победы</th>
                      <th>Польз.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50 font-semibold text-gray-600">
                    {snapshot.gameStats.map((row, index) => (
                      <tr key={`${row.day}-${row.game_type}-${index}`}>
                        <td className="py-3 text-indigo-900 font-black">{formatDate(row.day)}</td>
                        <td>{formatGameType(row.game_type)}</td>
                        <td>{row.games_started}</td>
                        <td>{row.games_finished}</td>
                        <td>{row.games_won}</td>
                        <td>{row.unique_users}</td>
                      </tr>
                    ))}
                    {snapshot.gameStats.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-gray-400">Пока нет игровых событий.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-indigo-950">Экономика</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-widest text-indigo-300">
                    <tr>
                      <th className="py-3">Дата</th>
                      <th>Получено</th>
                      <th>Потрачено</th>
                      <th>Покупки</th>
                      <th>Предметы</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50 font-semibold text-gray-600">
                    {snapshot.economyStats.map(row => (
                      <tr key={row.day}>
                        <td className="py-3 text-indigo-900 font-black">{formatDate(row.day)}</td>
                        <td>{row.coins_earned}</td>
                        <td>{row.coins_spent}</td>
                        <td>{row.purchases}</td>
                        <td>{row.items_used}</td>
                      </tr>
                    ))}
                    {snapshot.economyStats.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-400">Пока нет событий экономики.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-indigo-950">Слова пользователей вне общего словаря</h2>
                <p className="mt-1 text-sm font-semibold text-gray-500">Эти слова сохранены в пользовательских словарях, но не участвуют в играх.</p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">{unsupportedWordsCount} слов</div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase tracking-widest text-indigo-300">
                  <tr>
                    <th className="py-3">Пользователь</th>
                    <th>Количество</th>
                    <th>Слова</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50 font-semibold text-gray-600">
                  {snapshot.unsupportedDictionaryWords.map(row => (
                    <tr key={row.userId}>
                      <td className="py-3 font-black text-indigo-900">{row.username}</td>
                      <td>{row.words.length}</td>
                      <td className="max-w-xl break-words">{row.words.join(', ')}</td>
                    </tr>
                  ))}
                  {snapshot.unsupportedDictionaryWords.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-gray-400">Все загруженные слова входят в общий словарь.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-indigo-950">Последние типы событий</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.eventSummary.map(item => (
                <div key={`${item.event_type}-${item.event_name}`} className="rounded-2xl bg-indigo-50/70 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-indigo-300">{item.event_type}</div>
                  <div className="mt-1 font-black text-indigo-950">{item.event_name}</div>
                  <div className="mt-2 text-2xl font-black text-indigo-700">{item.count}</div>
                </div>
              ))}
              {snapshot.eventSummary.length === 0 && <div className="text-gray-400">Пока нет событий.</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
};