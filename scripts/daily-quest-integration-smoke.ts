import { createHmac } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/annword_perf';
const jwtSecret = process.env.JWT_SECRET || 'annword-api-performance-benchmark-secret';
const apiPort = Number(process.env.DAILY_QUEST_SMOKE_PORT || 8092);
const apiBase = `http://127.0.0.1:${apiPort}`;
const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 2 });

const signSession = (userId: string, email: string, version = 1): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: userId, email, ver: version, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${createHmac('sha256', jwtSecret).update(unsigned).digest('base64url')}`;
};

const moscowDateKey = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not resolve Moscow quest date');
  return `${year}-${month}-${day}`;
};

async function waitForApi(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited before daily-quest smoke with code ${child.exitCode}`);
    try { const response = await fetch(`${apiBase}/api/health`); if (response.ok) return; } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('API did not become healthy within 15s');
}

async function jsonRequest(token: string, endpoint: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: { Accept: 'application/json', 'X-AnnWord-Session': token, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${endpoint} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function main(): Promise<void> {
  const userResult = await pool.query<{ id: string; email: string; session_version: number }>("select id, email, session_version from app_users where email = 'perf-3@annword.test' limit 1");
  const user = userResult.rows[0];
  if (!user) throw new Error('Benchmark seed user perf-3 is missing. Run api-performance-benchmark first.');
  const questDate = moscowDateKey();
  await pool.query("update profiles set role = 'parent', account_mode = 'parent' where id = $1", [user.id]);
  await pool.query('delete from daily_quests where user_id = $1 and quest_date = $2', [user.id, questDate]);
  await pool.query(
    `insert into daily_quests (user_id, quest_date, kind, progress, completed)
     values ($1, $2, 'all_five_games', $3::jsonb, false)`,
    [user.id, questDate, JSON.stringify({ variant_key: 'all_five_games', completed_modes: [], anagram_solved: 0 })],
  );

  const token = signSession(user.id, user.email, user.session_version);
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/yandex-api.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(apiPort), DATABASE_URL: databaseUrl, PGSSL: 'disable', JWT_SECRET: jwtSecret, SESSION_SECRET: 'daily-quest-smoke-session-secret', COOKIE_SECRET: 'daily-quest-smoke-cookie-secret' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', chunk => process.stdout.write(`[daily-quest-api] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[daily-quest-api] ${chunk}`));

  try {
    await waitForApi(child);
    const first = await jsonRequest(token, '/api/daily-quest/today');
    const second = await jsonRequest(token, '/api/daily-quest/today');
    if (first.quest?.kind !== 'all_five_games' || second.quest?.kind !== 'all_five_games' || first.quest?.questDate !== second.quest?.questDate) throw new Error('Daily quest changed between reloads.');
    if (JSON.stringify(first.quest?.completedModes || []) !== '[]') throw new Error(`Unexpected initial progress: ${JSON.stringify(first.quest)}`);

    const firstThree = [
      { input: { type: 'letterSquare', guessedWords: 6 }, mode: 'letter_square' },
      { input: { type: 'hangman', won: true, mistakes: 2, maxMistakes: 7 }, mode: 'hangman' },
      { input: { type: 'memory', moves: 8 }, mode: 'memory' },
    ];

    for (let index = 0; index < firstThree.length; index += 1) {
      const result = await jsonRequest(token, '/api/daily-quest/result', { method: 'POST', body: JSON.stringify(firstThree[index].input) });
      const expectedCount = index + 1;
      if ((result.quest?.completedModes || []).length !== expectedCount || !result.quest?.completedModes?.includes(firstThree[index].mode)) {
        throw new Error(`Step ${expectedCount} progress mismatch: ${JSON.stringify(result.quest)}`);
      }
      if (result.quest?.completed) throw new Error(`Quest completed too early at step ${expectedCount}`);
    }

    for (let solved = 1; solved <= 5; solved += 1) {
      const result = await jsonRequest(token, '/api/daily-quest/result', {
        method: 'POST',
        body: JSON.stringify({ type: 'anagram', guessedWords: 1, coinsAdjustment: 0 }),
      });
      const modes = result.quest?.completedModes || [];
      if (solved < 5 && modes.includes('anagram')) throw new Error(`Anagram checkpoint completed too early after ${solved} reachable solves.`);
      if (solved === 5 && (!modes.includes('anagram') || modes.length !== 4)) {
        throw new Error(`Fifth reachable Anagram solve did not complete the checkpoint: ${JSON.stringify(result.quest)}`);
      }
      if (result.quest?.completed) throw new Error(`Quest completed before Sprint after Anagram solve ${solved}`);
    }

    const final = await jsonRequest(token, '/api/daily-quest/result', { method: 'POST', body: JSON.stringify({ type: 'sprint', guessedWords: 6 }) });
    if (!final.quest?.completed || (final.quest?.completedModes || []).length !== 5 || !final.quest?.completedModes?.includes('sprint')) {
      throw new Error(`Quest did not complete after the fifth mode: ${JSON.stringify(final.quest)}`);
    }

    const reload = await jsonRequest(token, '/api/daily-quest/today');
    if (!reload.quest?.completed || (reload.quest?.completedModes || []).length !== 5) throw new Error(`Completed quest did not survive reload: ${JSON.stringify(reload.quest)}`);
    const repeat = await jsonRequest(token, '/api/daily-quest/result', { method: 'POST', body: JSON.stringify({ type: 'sprint', guessedWords: 6 }) });
    if (!repeat.quest?.completed || repeat.reward !== null) throw new Error(`Repeated completion was not idempotent: ${JSON.stringify(repeat)}`);

    console.log('DAILY_QUEST_INTEGRATION_REPORT {"stableReload":"ok","reachableAnagrams":"ok","fiveModes":"ok","completedReload":"ok","idempotentReward":"ok"}');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 250));
    if (child.exitCode === null) child.kill('SIGKILL');
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
