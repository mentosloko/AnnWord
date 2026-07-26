from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return content.replace(old, new, 1)


# Send game starts immediately. Failed immediate sends are already placed back into
# the durable local queue by analyticsService.sendNow.
path = 'services/analyticsService.ts'
content = read(path)
old = """  trackEvent: (input: TrackEventInput): void => {
    try {
      readQueue().push(createAnalyticsEvent(input));
      persistQueue();
      scheduleFlush();
    } catch (error) {
      console.warn('Analytics enqueue failed', error);
    }
  },
"""
new = """  trackEvent: (input: TrackEventInput): void => {
    try {
      const event = createAnalyticsEvent(input);
      if (input.eventName === 'game_started') {
        void analyticsService.sendNow([event]);
        return;
      }
      readQueue().push(event);
      persistQueue();
      scheduleFlush();
    } catch (error) {
      console.warn('Analytics enqueue failed', error);
    }
  },
"""
write(path, replace_once(content, old, new, 'analytics immediate game start'))


# Add a server-side date range and aggregate rows by game mode. Analytics and
# ledger rows are merged per actor to avoid double counting. A recorded finish
# is proof that at least one start happened, even when old start telemetry was lost.
path = 'server/routes/analyticsRoutes.ts'
content = read(path)
old = """const csvCell = (value: unknown): string => `\"${String(value ?? '').replace(/\"/g, '\"\"')}\"`;

analyticsRouter.get('/admin/export.csv', requireAdmin, async (_req: AuthenticatedRequest, res) => {
"""
new = """const csvCell = (value: unknown): string => `\"${String(value ?? '').replace(/\"/g, '\"\"')}\"`;
const ISO_DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const shiftIsoDate = (value: string, days: number): string => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
};
const dateQueryValue = (value: unknown): string | null => typeof value === 'string' && ISO_DATE_PATTERN.test(value) ? value : null;
const resolveAdminGameRange = (fromValue: unknown, toValue: unknown): { from: string; to: string } => {
  const today = isoDate(new Date());
  let to = dateQueryValue(toValue) || today;
  let from = dateQueryValue(fromValue) || shiftIsoDate(to, -29);
  if (from > to) [from, to] = [to, from];
  return { from, to };
};

analyticsRouter.get('/admin/export.csv', requireAdmin, async (_req: AuthenticatedRequest, res) => {
"""
content = replace_once(content, old, new, 'analytics date helpers')
content = replace_once(
    content,
    "analyticsRouter.get('/admin', requireAdmin, async (_req: AuthenticatedRequest, res) => {\n  try {\n    const [gameStats, economyStats, eventSummary, dictionaries, loadingPerformance, economyOverview] = await Promise.all([\n",
    "analyticsRouter.get('/admin', requireAdmin, async (req: AuthenticatedRequest, res) => {\n  try {\n    const gameRange = resolveAdminGameRange(req.query?.from, req.query?.to);\n    const [gameStats, economyStats, eventSummary, dictionaries, loadingPerformance, economyOverview] = await Promise.all([\n",
    'analytics route range',
)
old_query = """      query<{
        day: string;
        game_type: string | null;
        games_started: number;
        games_finished: number;
        games_won: number;
        unique_users: number;
      }>(
        `select occurred_at::date::text as day,
                game_type,
                count(*) filter (where event_name = 'game_started')::int as games_started,
                count(*) filter (where event_name = 'game_finished')::int as games_finished,
                count(*) filter (
                  where event_name = 'game_finished'
                    and (payload->>'won' = 'true' or payload->'input'->>'won' = 'true')
                )::int as games_won,
                count(distinct user_id) filter (where user_id is not null)::int as unique_users
           from analytics_events
          where occurred_at >= current_date - interval '30 days'
            and event_name in ('game_started', 'game_finished')
          group by occurred_at::date, game_type
          order by occurred_at::date desc, game_type nulls last
          limit 120`,
      ),
"""
new_query = """      query<{
        game_type: string | null;
        games_started: number;
        games_finished: number;
        games_won: number;
        unique_users: number;
        inferred_starts: number;
      }>(
        `with analytics_by_actor as (
           select coalesce(game_type, 'other') as game_type,
                  coalesce(user_id::text, nullif(session_id, ''), 'anonymous') as actor_key,
                  count(*) filter (where event_name = 'game_started')::int as starts,
                  count(*) filter (where event_name = 'game_finished')::int as finishes,
                  count(*) filter (
                    where event_name = 'game_finished'
                      and (
                        payload->>'won' = 'true'
                        or (coalesce(payload->>'guessedWords', '') ~ '^[0-9]+$' and (payload->>'guessedWords')::int > 0)
                        or (coalesce(payload->>'clicks', '') ~ '^[0-9]+$' and (payload->>'clicks')::int > 0)
                      )
                  )::int as wins
             from analytics_events
            where occurred_at >= $1::date
              and occurred_at < ($2::date + interval '1 day')
              and event_name in ('game_started', 'game_finished')
            group by coalesce(game_type, 'other'), coalesce(user_id::text, nullif(session_id, ''), 'anonymous')
         ), ledger_by_actor as (
           select coalesce(game_mode, 'other') as game_type,
                  user_id::text as actor_key,
                  count(*) filter (where event_type = 'game_started')::int as starts,
                  count(*) filter (where event_type = 'game_finished')::int as finishes,
                  count(*) filter (
                    where event_type = 'game_finished'
                      and (
                        payload->'input'->>'won' = 'true'
                        or (coalesce(payload->'input'->>'guessedWords', '') ~ '^[0-9]+$' and (payload->'input'->>'guessedWords')::int > 0)
                        or (coalesce(payload->'input'->>'clicks', '') ~ '^[0-9]+$' and (payload->'input'->>'clicks')::int > 0)
                      )
                  )::int as wins
             from game_events
            where occurred_at >= $1::date
              and occurred_at < ($2::date + interval '1 day')
              and event_type in ('game_started', 'game_finished')
            group by coalesce(game_mode, 'other'), user_id::text
         ), actors as (
           select coalesce(analytics.game_type, ledger.game_type) as game_type,
                  coalesce(analytics.actor_key, ledger.actor_key) as actor_key,
                  greatest(coalesce(analytics.starts, 0), coalesce(ledger.starts, 0)) as recorded_starts,
                  greatest(coalesce(analytics.finishes, 0), coalesce(ledger.finishes, 0)) as finishes,
                  greatest(coalesce(analytics.wins, 0), coalesce(ledger.wins, 0)) as wins
             from analytics_by_actor analytics
             full join ledger_by_actor ledger using (game_type, actor_key)
         )
         select game_type,
                coalesce(sum(greatest(recorded_starts, finishes)), 0)::int as games_started,
                coalesce(sum(finishes), 0)::int as games_finished,
                coalesce(sum(wins), 0)::int as games_won,
                count(*)::int as unique_users,
                coalesce(sum(greatest(finishes - recorded_starts, 0)), 0)::int as inferred_starts
           from actors
          group by game_type
          order by games_started desc, game_type`,
        [gameRange.from, gameRange.to],
      ),
"""
content = replace_once(content, old_query, new_query, 'game stats aggregation')
content = replace_once(
    content,
    "      gameStats: gameStats.rows,\n      economyStats: economyStats.rows,\n",
    "      gameStats: gameStats.rows,\n      gameRange,\n      economyStats: economyStats.rows,\n",
    'game range response',
)
write(path, content)


# Update the client service contract and let the Yandex endpoint receive the
# selected period. The Supabase fallback aggregates its daily view into modes.
path = 'services/adminAnalyticsService.ts'
content = read(path)
content = replace_once(
    content,
    """export interface AdminDailyGameStat {
  day: string;
  game_type: string | null;
  games_started: number;
  games_finished: number;
  games_won: number;
  unique_users: number;
}
""",
    """export interface AdminGameStat {
  game_type: string | null;
  games_started: number;
  games_finished: number;
  games_won: number;
  unique_users: number;
  inferred_starts: number;
}
export interface AdminGameDateRange { from: string; to: string; }
interface AdminDailyGameStatRow extends Omit<AdminGameStat, 'inferred_starts'> { day: string; inferred_starts?: number; }
""",
    'admin game stat interface',
)
content = replace_once(content, "  gameStats: AdminDailyGameStat[];\n", "  gameStats: AdminGameStat[];\n  gameRange: AdminGameDateRange;\n", 'snapshot game range interface')
content = replace_once(
    content,
    "const parseNumber = (value: unknown): number => Number(value || 0);\n",
    """const parseNumber = (value: unknown): number => Number(value || 0);
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const shiftIsoDate = (value: string, days: number): string => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return isoDate(date); };
const defaultGameRange = (): AdminGameDateRange => { const to = isoDate(new Date()); return { from: shiftIsoDate(to, -29), to }; };
const safeGameRange = (range?: Partial<AdminGameDateRange> | null): AdminGameDateRange => {
  const fallback = defaultGameRange();
  let from = /^\\d{4}-\\d{2}-\\d{2}$/.test(range?.from || '') ? range!.from! : fallback.from;
  let to = /^\\d{4}-\\d{2}-\\d{2}$/.test(range?.to || '') ? range!.to! : fallback.to;
  if (from > to) [from, to] = [to, from];
  return { from, to };
};
""",
    'client range helpers',
)
content = replace_once(
    content,
    """    unique_users: parseNumber(row.unique_users),
  })) : [],
  economyStats:""",
    """    unique_users: parseNumber(row.unique_users),
    inferred_starts: parseNumber(row.inferred_starts),
  })) : [],
  gameRange: safeGameRange(value?.gameRange),
  economyStats:""",
    'normalize game range',
)
content = replace_once(
    content,
    """  loadSnapshot: async (): Promise<AdminAnalyticsSnapshot> => {
    if (isBackendApiConfigured) return normalizeSnapshot(await backendApiRequest<AdminAnalyticsSnapshot>('/api/analytics/admin'));

    const [gameStatsResult, economyStatsResult, eventSummaryResult, customDictionaryResult] = await Promise.all([
      supabase.from('admin_daily_game_stats').select('*').order('day', { ascending: false }).limit(30),
""",
    """  loadSnapshot: async (range?: AdminGameDateRange): Promise<AdminAnalyticsSnapshot> => {
    const selectedRange = safeGameRange(range);
    if (isBackendApiConfigured) {
      const params = new URLSearchParams(selectedRange);
      return normalizeSnapshot(await backendApiRequest<AdminAnalyticsSnapshot>(`/api/analytics/admin?${params.toString()}`));
    }

    const [gameStatsResult, economyStatsResult, eventSummaryResult, customDictionaryResult] = await Promise.all([
      supabase.from('admin_daily_game_stats').select('*').gte('day', selectedRange.from).lte('day', selectedRange.to).order('day', { ascending: false }),
""",
    'load selected range',
)
old_return = """    return normalizeSnapshot({
      gameStats: gameStatsResult.data || [],
      economyStats: economyStatsResult.data || [],
      eventSummary: Array.from(summaryMap.values()).sort((a, b) => b.count - a.count),
      unsupportedDictionaryWords,
      loadingPerformance: [],
    });
"""
new_return = """    const gameMap = new Map<string, AdminGameStat>();
    for (const row of (gameStatsResult.data || []) as AdminDailyGameStatRow[]) {
      const key = row.game_type || 'other';
      const current = gameMap.get(key) || { game_type: row.game_type || 'other', games_started: 0, games_finished: 0, games_won: 0, unique_users: 0, inferred_starts: 0 };
      const recordedStarts = parseNumber(row.games_started);
      const finishes = parseNumber(row.games_finished);
      current.games_started += Math.max(recordedStarts, finishes);
      current.games_finished += finishes;
      current.games_won += parseNumber(row.games_won);
      current.unique_users = Math.max(current.unique_users, parseNumber(row.unique_users));
      current.inferred_starts += Math.max(finishes - recordedStarts, 0);
      gameMap.set(key, current);
    }

    return normalizeSnapshot({
      gameStats: Array.from(gameMap.values()).sort((first, second) => second.games_started - first.games_started),
      gameRange: selectedRange,
      economyStats: economyStatsResult.data || [],
      eventSummary: Array.from(summaryMap.values()).sort((a, b) => b.count - a.count),
      unsupportedDictionaryWords,
      loadingPerformance: [],
    });
"""
content = replace_once(content, old_return, new_return, 'aggregate fallback game rows')
write(path, content)


# Rework the admin game block: native date inputs open platform calendars, and
# rows are game modes for the selected inclusive period.
path = 'components/screens/AdminAnalyticsScreen.tsx'
content = read(path)
content = replace_once(
    content,
    "import { adminAnalyticsService, AdminAnalyticsSnapshot } from '../../services/adminAnalyticsService';",
    "import { adminAnalyticsService, AdminAnalyticsSnapshot, AdminGameDateRange } from '../../services/adminAnalyticsService';",
    'admin screen range import',
)
content = replace_once(
    content,
    "const formatGameType = (type: string | null): string => ({ wordle: 'Классика', hangman: 'Виселица', sprint: 'Спринт', anagram: 'Анаграммы', memory: 'Память', letterSquare: 'Змейка' }[type || ''] || 'Другой режим');",
    "const formatGameType = (type: string | null): string => ({ wordle: 'Классика', hangman: 'Виселица', sprint: 'Спринт', anagram: 'Анаграммы', memory: 'Память', letterSquare: 'Змейка', translation: 'Перевод', other: 'Другой режим' }[type || ''] || 'Другой режим');",
    'game mode labels',
)
content = replace_once(
    content,
    "const formatDuration = (value: number): string => value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} с` : `${Math.round(value)} мс`;\n",
    """const formatDuration = (value: number): string => value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} с` : `${Math.round(value)} мс`;
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const shiftDate = (value: string, days: number): string => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return isoDate(date); };
const initialGameRange = (): AdminGameDateRange => { const to = isoDate(new Date()); return { from: shiftDate(to, -6), to }; };
const completionRate = (started: number, finished: number): string => started > 0 ? `${Math.min(100, Math.round((finished / started) * 100))}%` : '—';
""",
    'admin date UI helpers',
)
content = replace_once(
    content,
    """  const [isExporting, setIsExporting] = useState(false);
  const isAdmin = userProfile.role === 'admin';
""",
    """  const [isExporting, setIsExporting] = useState(false);
  const [gameRange, setGameRange] = useState<AdminGameDateRange>(() => initialGameRange());
  const [gameRangeDraft, setGameRangeDraft] = useState<AdminGameDateRange>(() => initialGameRange());
  const isAdmin = userProfile.role === 'admin';
""",
    'admin date UI state',
)
content = replace_once(
    content,
    """    adminAnalyticsService.loadSnapshot()
      .then(data => { if (!cancelled) setSnapshot(data); })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить аналитику'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [isAdmin]);
""",
    """    adminAnalyticsService.loadSnapshot(gameRange)
      .then(data => { if (!cancelled) setSnapshot(data); })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить аналитику'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [gameRange.from, gameRange.to, isAdmin]);
""",
    'load admin selected range',
)
content = replace_once(
    content,
    """  const exportCsv = async () => {
""",
    """  const applyGameRange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!gameRangeDraft.from || !gameRangeDraft.to) { setError('Выберите обе даты.'); return; }
    const nextRange = gameRangeDraft.from <= gameRangeDraft.to ? gameRangeDraft : { from: gameRangeDraft.to, to: gameRangeDraft.from };
    setError(null);
    setGameRange(nextRange);
    setGameRangeDraft(nextRange);
  };

  const exportCsv = async () => {
""",
    'apply selected range',
)
pattern = re.compile(r"      <section className=\"grid gap-6 lg:grid-cols-2\">\n.*?\n      </section>\n\n      <section className=\"rounded-\[2rem\] border border-amber", re.S)
match = pattern.search(content)
if not match:
    raise SystemExit('game/economy admin section not found')
replacement = """      <section className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm">
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

      <section className="rounded-[2rem] border border-amber"""
content = content[:match.start()] + replacement + content[match.end():]
write(path, content)


# Add a regression test focused on the durable start path and the requested UI.
test_path = Path('tests/adminGameDateRange.test.ts')
test_path.write_text("""import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin game statistics range', () => {
  it('sends game starts immediately with queue fallback', () => {
    const source = read('services/analyticsService.ts');
    expect(source).toContain("if (input.eventName === 'game_started')");
    expect(source).toContain('void analyticsService.sendNow([event])');
  });

  it('uses inclusive date inputs and groups the table by game mode', () => {
    const source = read('components/screens/AdminAnalyticsScreen.tsx');
    expect(source.match(/type=\"date\"/g)).toHaveLength(2);
    expect(source).toContain('Игры за период');
    expect(source).toContain('formatGameType(row.game_type)');
    expect(source).not.toContain('key={`${row.day}-${row.game_type}-${index}`}');
  });

  it('never reports fewer starts than recorded finishes', () => {
    const source = read('server/routes/analyticsRoutes.ts');
    expect(source).toContain('sum(greatest(recorded_starts, finishes))');
    expect(source).toContain('inferred_starts');
  });
});
""", encoding='utf-8')
