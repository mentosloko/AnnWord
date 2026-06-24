import { normalizeDailyQuest } from '../services/dailyQuest';

type Json = Record<string, any>;

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function runNormalizerSmoke(): void {
  const backendPayload = normalizeDailyQuest({
    questDate: '2026-06-24',
    kind: 'sprint_twelve',
    title: 'Быстрый старт',
    description: 'Отгадай не менее 4 слов за одну игру в Спринте.',
    progressLabel: 'Испытание выполнено',
    completed: true,
    completedAt: '2026-06-24T10:00:00.000Z',
    rewardItemId: null,
    rewardWorldId: null,
    variantKey: 'sprint_four',
  });
  assert(backendPayload?.questDate === '2026-06-24', 'Backend camelCase questDate was not normalized.');
  assert(backendPayload?.completed === true, 'Backend camelCase completed flag was not normalized.');
  assert(backendPayload?.completedAt, 'Backend camelCase completedAt was not normalized.');

  const supabasePayload = normalizeDailyQuest({
    quest_date: '2026-06-24',
    kind: 'wordle_four',
    completed: true,
    completed_at: '2026-06-24T10:00:00.000Z',
    reward_item_id: null,
    reward_world_id: null,
    variant_key: 'wordle_win',
  });
  assert(supabasePayload?.questDate === '2026-06-24', 'Supabase snake_case questDate was not normalized.');
  assert(supabasePayload?.completed === true, 'Supabase snake_case completed flag was not normalized.');

  const progressPayload = normalizeDailyQuest({
    questDate: '2026-06-24',
    kind: 'all_five_games',
    completed: false,
    progress: { variant_key: 'all_five_games', completed_modes: ['wordle', 'memory'] },
  });
  assert(progressPayload?.progressLabel.startsWith('2/5'), 'All-games daily quest progress label was not normalized.');
}

async function fetchJson(url: string, init?: RequestInit): Promise<Json> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null) as Json | null;
  if (!response.ok) throw new Error(`${init?.method || 'GET'} ${url} failed: ${response.status} ${payload?.error || ''}`.trim());
  return payload || {};
}

async function runOptionalApiSmoke(): Promise<void> {
  const rawApiUrl = process.env.ANNWORD_API_URL || process.env.API_URL || process.env.YC_API_PUBLIC_URL;
  const email = process.env.ANNWORD_SMOKE_EMAIL;
  const password = process.env.ANNWORD_SMOKE_PASSWORD;
  if (!rawApiUrl || !email || !password) {
    console.log('Daily quest API smoke skipped: set ANNWORD_API_URL, ANNWORD_SMOKE_EMAIL and ANNWORD_SMOKE_PASSWORD to run it.');
    return;
  }

  const apiUrl = rawApiUrl.replace(/\/+$/, '');
  await fetchJson(`${apiUrl}/api/health`);
  const session = await fetchJson(`${apiUrl}/api/auth/email/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credential: password }),
  });
  const token = typeof session.access_token === 'string' ? session.access_token : '';
  assert(token, 'Login did not return access_token.');

  const today = await fetchJson(`${apiUrl}/api/daily-quest/today`, { headers: { 'X-AnnWord-Session': token } });
  const quest = normalizeDailyQuest(today.quest);
  assert(quest?.questDate, 'Daily quest /today did not return a normalized quest.');
  assert(typeof quest.completed === 'boolean', 'Daily quest /today did not return completed flag.');

  if (process.env.ANNWORD_DAILY_QUEST_SMOKE_SUBMIT === 'true') {
    const inputByKind: Record<string, Json> = {
      wordle_four: { type: 'wordle', won: true, attempts: 1 },
      sprint_twelve: { type: 'sprint', guessedWords: 99 },
      memory_sixteen: { type: 'memory', clicks: 1 },
      hangman_clean: { type: 'hangman', won: true, mistakes: 0, maxMistakes: 7 },
      all_five_games: { type: 'memory', clicks: 1 },
    };
    const result = await fetchJson(`${apiUrl}/api/daily-quest/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AnnWord-Session': token },
      body: JSON.stringify(inputByKind[quest.kind] || { type: 'other' }),
    });
    const updatedQuest = normalizeDailyQuest(result.quest);
    assert(updatedQuest?.questDate === quest.questDate, 'Daily quest /result returned a mismatched quest date.');
  }
}

runNormalizerSmoke();
await runOptionalApiSmoke();
console.log('Daily quest smoke checks passed.');
