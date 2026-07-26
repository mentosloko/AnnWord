import React, { useEffect, useMemo, useState } from 'react';
import { adminAnalyticsService, AdminAnalyticsSnapshot, AdminGameDateRange } from '../../services/adminAnalyticsService';
import { UserProfile } from '../../types';

interface AdminAnalyticsScreenProps { userProfile: UserProfile; onBackHome: () => void; }
const formatGameType = (type: string | null): string => ({ wordle: 'Классика', hangman: 'Виселица', sprint: 'Спринт', anagram: 'Анаграммы', memory: 'Память', letterSquare: 'Змейка', translation: 'Перевод', other: 'Другой режим' }[type || ''] || 'Другой режим');
const formatEventType = (type: string): string => ({ game: 'Игра', reward: 'Награда', economy: 'Экономика', inventory: 'Инвентарь', character: 'Персонаж', dictionary: 'Словарь', auth: 'Вход', navigation: 'Навигация', performance: 'Производительность', premium: 'Premium', payment: 'Оплата' }[type] || 'Другое');
const formatEventName = (name: string): string => ({ game_started: 'Игра начата', game_finished: 'Игра завершена', hint_used: 'Подсказка использована', reward_granted: 'Награда начислена', shop_item_bought: 'Предмет куплен', inventory_item_used: 'Предмет использован', character_selected: 'Персонаж выбран', dictionary_uploaded: 'Словарь загружен', route_changed: 'Переход между экранами', login_success: 'Вход выполнен', logout: 'Выход выполнен', request_completed: 'Запрос завершён', request_failed: 'Ошибка запроса', screen_state_changed: 'Состояние экрана', premium_opened: 'Открыли Premium', premium_plan_selected: 'Выбрали тариф', checkout_created: 'Checkout создан', checkout_redirected: 'Перешли к оплате', payment_return_success: 'Оплата подтверждена', payment_return_pending: 'Подтверждение ожидается', payment_return_failed: 'Оплата не подтверждена', premium_activated: 'Premium активирован', payment_error: 'Ошибка оплаты' }[name] || 'Другое событие');
const PREMIUM_FUNNEL_EVENTS = ['premium_opened', 'premium_plan_selected', 'checkout_created', 'checkout_redirected', 'payment_return_pending', 'payment_return_success', 'premium_activated', 'payment_return_failed', 'payment_error'] as const;
const formatDate = (value: string): string => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }); };
const formatDuration = (value: number): string => value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} с` : `${Math.round(value)} мс`;
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const shiftDate = (value: string, days: number): string => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return isoDate(date); };
const initialGameRange = (): AdminGameDateRange => { const to = isoDate(new Date()); return { from: shiftDate(to, -6), to }; };
const completionRate = (started: number, finished: number): string => started > 0 ? `${Math.min(100, Math.round((finished / started) * 100))}%` : '—';
const StatCard: React.FC<{ label: string; value: number | string; hint?: string }> = ({ label, value, hint }) => <div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-widest text-indigo-300">{label}</div><div className="mt-2 text-3xl font-black text-indigo-950">{value}</div>{hint && <div className="mt-1 text-xs font-semibold text-gray-400">{hint}</div>}</div>;

export const AdminAnalyticsScreen: React.FC<AdminAnalyticsScreenProps> = ({ userProfile, onBackHome }) => {
  const [snapshot, setSnapshot] = useState<AdminAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [gameRange, setGameRange] = useState<AdminGameDateRange>(() => initialGameRange());
  const [gameRangeDraft, setGameRangeDraft] = useState<AdminGameDateRange>(() => initialGameRange());
  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    if (!isAdmin) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    adminAnalyticsService.loadSnapshot(gameRange)
      .then(data => { if (!cancelled) setSnapshot(data); })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить аналитику'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [gameRange.from, gameRange.to, isAdmin]);

  const totals = useMemo(() => {
    const gameRows = snapshot?.gameStats || [];
    const economyRows = snapshot?.economyStats || [];
    return {
      gamesStarted: gameRows.reduce((sum, row) => sum + row.games_started, 0),
      gamesFinished: gameRows.reduce((sum, row) => sum + row.games_finished, 0),
      gamesWon: gameRows.reduce((sum, row) => sum + row.games_won, 0),
      coinsEarned: economyRows.reduce((sum, row) => sum + row.coins_earned, 0),
      coinsSpent: economyRows.reduce((sum, row) => sum + row.coins_spent, 0),
      purchases: economyRows.reduce((sum, row) => sum + row.purchases, 0),
    };
  }, [snapshot]);
  const unsupportedWordsCount = useMemo(() => (snapshot?.unsupportedDictionaryWords || []).reduce((sum, row) => sum + row.words.length, 0), [snapshot]);
  const premiumFunnel = useMemo(() => {
    const counts = new Map((snapshot?.eventSummary || []).map(item => [item.event_name, item.count]));
    return PREMIUM_FUNNEL_EVENTS.map(eventName => ({ eventName, count: counts.get(eventName) || 0 }));
  }, [snapshot]);

  const applyGameRange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!gameRangeDraft.from || !gameRangeDraft.to) { setError('Выберите обе даты.'); return; }
    const nextRange = gameRangeDraft.from <= gameRangeDraft.to ? gameRangeDraft : { from: gameRangeDraft.to, to: gameRangeDraft.from };
    setError(null);
    setGameRange(nextRange);
    setGameRangeDraft(nextRange);
  };

  const exportCsv = async () => {
    setIsExporting(true);
    setError(null);
    try { await adminAnalyticsService.downloadEventsCsv(); }
    catch (exportError) { setError(exportError instanceof Error ? exportError.message : 'Не удалось выгрузить CSV'); }
    finally { setIsExporting(false); }
  };

  if (!isAdmin) return <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 text-center"><div className="rounded-[2rem] border border-indigo-100 bg-white p-8 shadow-xl"><div className="text-5xl">🔒</div><h1 className="mt-4 text-2xl font-black text-indigo-950">Раздел только для администратора</h1><p className="mt-2 text-gray-500">У текущего профиля нет доступа к аналитике.</p><button onClick={onBackHome} className="mt-6 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">На главную</button></div></main>;

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="text-xs font-black uppercase tracking-[0.25em] text-indigo-300">Панель администратора</div><h1 className="mt-2 text-3xl font-black text-indigo-950 sm:text-4xl">Аналитика AnnWord</h1><p className="mt-2 text-sm font-semibold text-gray-500">Игры, награды, покупки, производительность и словари пользователей.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void exportCsv()} disabled={isExporting} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">{isExporting ? 'Готовлю CSV…' : 'Выгрузить все события CSV'}</button><button onClick={onBackHome} className="rounded-2xl border border-indigo-100 bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-sm hover:bg-indigo-50">На главную</button></div>
    </div>
    {isLoading && <div className="rounded-3xl border border-indigo-100 bg-white p-8 text-center font-bold text-indigo-700 shadow-sm">Загружаю аналитику...</div>}
    {error && <div className="mb-5 rounded-3xl border border-red-100 bg-red-50 p-6 font-bold text-red-700">{error}</div>}
    {!isLoading && snapshot && <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Стартов игр" value={totals.gamesStarted} /><StatCard label="Завершений" value={totals.gamesFinished} /><StatCard label="Побед" value={totals.gamesWon} /><StatCard label="Монет на аккаунтах" value={snapshot.economyOverview.total_coins} hint={`${snapshot.economyOverview.users_with_coins} пользователей с балансом`} /></section>

      <section className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-indigo-950">Воронка Premium</h2><p className="mt-1 text-sm font-semibold text-gray-500">События последних 1000 записей аналитики.</p></div><div className="rounded-2xl bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">{premiumFunnel.reduce((sum, item) => sum + item.count, 0)} событий</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{premiumFunnel.map(item => <div key={item.eventName} className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><div className="text-sm font-black text-indigo-950">{formatEventName(item.eventName)}</div><div className="mt-2 text-3xl font-black text-violet-700">{item.count}</div></div>)}</div></section>

      <section className="rounded-[2rem] border border-sky-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-indigo-950">Скорость загрузки API</h2><p className="mt-1 text-sm font-semibold text-gray-500">Клиентское ожидание за последние 7 дней. p95 — время, быстрее которого завершились 95% запросов.</p></div><div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-black text-sky-700">{snapshot.loadingPerformance.reduce((sum, row) => sum + row.requests, 0)} измерений</div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-widest text-sky-400"><tr><th className="py-3">Маршрут</th><th>Запросов</th><th>Среднее</th><th>p95</th><th>Ошибок</th><th>Таймаутов</th><th>Объединено</th></tr></thead><tbody className="divide-y divide-sky-50 font-semibold text-gray-600">{snapshot.loadingPerformance.map(row => <tr key={row.path}><td className="py-3 font-mono text-xs font-black text-indigo-900">{row.path}</td><td>{row.requests}</td><td>{formatDuration(row.avg_duration_ms)}</td><td>{formatDuration(row.p95_duration_ms)}</td><td>{row.errors}</td><td>{row.timeouts}</td><td>{row.deduplicated}</td></tr>)}{snapshot.loadingPerformance.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400">Метрики появятся после использования новой версии приложения.</td></tr>}</tbody></table></div></section>

      <section className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><h2 className="text-xl font-black text-indigo-950">Игры за период</h2><p className="mt-1 text-sm font-semibold text-gray-500">Каждая строка — игровой режим. Даты включаются в отчёт целиком.</p></div>
          <form onSubmit={applyGameRange} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="text-xs font-black uppercase tracking-widest text-indigo-400">С даты<input type="date" value={gameRangeDraft.from} max={gameRangeDraft.to || undefined} onChange={event => setGameRangeDraft(previous => ({ ...previous, from: event.target.value }))} className="mt-1 block w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2.5 text-sm font-bold text-indigo-950 outline-none focus:border-indigo-400" /></label>
            <label className="text-xs font-black uppercase tracking-widest text-indigo-400">По дату<input type="date" value={gameRangeDraft.to} min={gameRangeDraft.from || undefined} max={isoDate(new Date())} onChange={event => setGameRangeDraft(previous => ({ ...previous, to: event.target.value }))} className="mt-1 block w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2.5 text-sm font-bold text-indigo-950 outline-none focus:border-indigo-400" /></label>
            <button type="submit" disabled={isLoading} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{isLoading ? 'Загружаю…' : 'Показать'}</button>
          </form>
        </div>
        <div className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-700">Период: {snapshot.gameRange.from.split('-').reverse().join('.')} — {snapshot.gameRange.to.split('-').reverse().join('.')}. Если в старых данных сохранился финиш без старта, он учитывается как подтверждённый запуск.</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-widest text-indigo-300"><tr><th className="py-3">Режим</th><th>Запуски</th><th>Финиши</th><th>Победы</th><th>Завершение</th><th>Польз.</th></tr></thead><tbody className="divide-y divide-indigo-50 font-semibold text-gray-600">{snapshot.gameStats.map(row => <tr key={row.game_type || 'other'}><td className="py-3 font-black text-indigo-900">{formatGameType(row.game_type)}</td><td>{row.games_started}{row.inferred_starts > 0 && <span title={`${row.inferred_starts} запусков восстановлено по сохранённым финишам`} className="ml-1 text-amber-500">*</span>}</td><td>{row.games_finished}</td><td>{row.games_won}</td><td>{completionRate(row.games_started, row.games_finished)}</td><td>{row.unique_users}</td></tr>)}{snapshot.gameStats.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-400">За выбранный период игровых событий нет.</td></tr>}</tbody></table></div>
        {snapshot.gameStats.some(row => row.inferred_starts > 0) && <p className="mt-3 text-xs font-semibold text-amber-700">* Часть старых стартов была восстановлена по факту завершения игры. Новая версия записывает старт сразу.</p>}
      </section>

      <section className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-indigo-950">Экономика</h2><p className="mt-1 text-xs font-semibold text-gray-500">История событий заполняется с этой версии; текущие остатки показаны выше.</p></div><div className="text-right text-xs font-black text-indigo-600">Получено: {totals.coinsEarned}<br/>Потрачено: {totals.coinsSpent}</div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead className="text-xs uppercase tracking-widest text-indigo-300"><tr><th className="py-3">Дата</th><th>Получено</th><th>Потрачено</th><th>Покупки</th><th>Предметы</th></tr></thead><tbody className="divide-y divide-indigo-50 font-semibold text-gray-600">{snapshot.economyStats.map(row => <tr key={row.day}><td className="py-3 font-black text-indigo-900">{formatDate(row.day)}</td><td>{row.coins_earned}</td><td>{row.coins_spent}</td><td>{row.purchases}</td><td>{row.items_used}</td></tr>)}{snapshot.economyStats.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">События экономики появятся после новых игр и покупок.</td></tr>}</tbody></table></div></section>

      <section className="rounded-[2rem] border border-amber-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-indigo-950">Слова пользователей вне общего словаря</h2><p className="mt-1 text-sm font-semibold text-gray-500">Сравнение выполняется с фактическим общим словарём сборки.</p></div><div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">{unsupportedWordsCount} слов</div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase tracking-widest text-indigo-300"><tr><th className="py-3">Пользователь</th><th>Количество</th><th>Слова</th></tr></thead><tbody className="divide-y divide-indigo-50 font-semibold text-gray-600">{snapshot.unsupportedDictionaryWords.map(row => <tr key={row.userId}><td className="py-3 font-black text-indigo-900">{row.username}</td><td>{row.words.length}</td><td className="max-w-xl break-words">{row.words.join(', ')}</td></tr>)}{snapshot.unsupportedDictionaryWords.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-gray-400">Все загруженные слова входят в общий словарь.</td></tr>}</tbody></table></div></section>

      <section className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-indigo-950">Последние типы событий</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{snapshot.eventSummary.map(item => <div key={`${item.event_type}-${item.event_name}`} className="rounded-2xl bg-indigo-50/70 p-4"><div className="text-xs font-black uppercase tracking-widest text-indigo-300">{formatEventType(item.event_type)}</div><div className="mt-1 font-black text-indigo-950">{formatEventName(item.event_name)}</div><div className="mt-2 text-2xl font-black text-indigo-700">{item.count}</div></div>)}{snapshot.eventSummary.length === 0 && <div className="text-gray-400">Пока нет событий.</div>}</div></section>
    </div>}
  </main>;
};
