import { createHash, createHmac, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/annword_perf';
const apiPort = Number(process.env.API_PERF_PORT || 8090);
const apiBase = `http://127.0.0.1:${apiPort}`;
const jwtSecret = process.env.JWT_SECRET || 'annword-api-performance-benchmark-secret';
const migrationsDir = path.resolve(process.cwd(), 'db', 'yandex');
const usersCount = 8;

type BenchResult = { label: string; durationMs: number; status: number; serverTiming: string };
type SeedUser = { id: string; email: string; token: string };

const percentile = (values: number[], ratio: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
};

const signSession = (userId: string, email: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: userId, email, ver: 1, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${body}`;
  const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 4 });

async function resetDatabase(): Promise<void> {
  await pool.query('drop schema public cascade; create schema public;');
  const files = (await readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
}

async function seedUsers(): Promise<SeedUser[]> {
  const users: SeedUser[] = [];
  for (let index = 0; index < usersCount; index += 1) {
    const id = randomUUID();
    const email = `perf-${index}@annword.test`;
    await pool.query(
      `insert into app_users (id, email, password_hash, full_name, email_confirmed_at)
       values ($1, $2, 'unused', $3, now())`,
      [id, email, `Perf ${index}`],
    );
    await pool.query(
      `insert into profiles (id, username, role, account_mode)
       values ($1, $2, 'user', 'player')`,
      [id, `Perf ${index}`],
    );
    await pool.query(
      `insert into assigned_word_sets (adult_user_id, learner_user_id, title, words)
       values ($1, $1, 'Benchmark', array['BOOK','SCHOOL','APPLE'])`,
      [id],
    );
    users.push({ id, email, token: signSession(id, email) });
  }
  return users;
}

async function waitForApi(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited before benchmark with code ${child.exitCode}`);
    try {
      const response = await fetch(`${apiBase}/api/health`);
      if (response.ok) return;
    } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('API did not become healthy within 15s');
}

async function rawRequest(user: SeedUser, endpoint: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-AnnWord-Session': user.token,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function request(label: string, user: SeedUser, endpoint: string, init: RequestInit = {}): Promise<{ bench: BenchResult; body: any }> {
  const startedAt = performance.now();
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-AnnWord-Session': user.token,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  const bench = {
    label,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    status: response.status,
    serverTiming: response.headers.get('server-timing') || '',
  };
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${JSON.stringify(body)}`);
  return { bench, body };
}

function assertTiming(result: BenchResult, names: string[]): void {
  for (const name of names) {
    if (!result.serverTiming.includes(`${name};dur=`)) {
      throw new Error(`${result.label} is missing Server-Timing metric ${name}: ${result.serverTiming}`);
    }
  }
}

async function runBenchmark(users: SeedUser[]): Promise<void> {
  const primary = users[0];
  const results: BenchResult[] = [];

  const coldBootstrap = await request('bootstrap-cold', primary, '/api/profile/bootstrap');
  results.push(coldBootstrap.bench);
  assertTiming(coldBootstrap.bench, ['bootstrap_total', 'bootstrap_profile', 'bootstrap_quest', 'auth', 'db_wait', 'db_query']);
  const profile = coldBootstrap.body.profile;

  const warmBootstrap: BenchResult[] = [];
  for (let index = 0; index < 10; index += 1) {
    const result = await request(`bootstrap-warm-${index + 1}`, primary, '/api/profile/bootstrap');
    warmBootstrap.push(result.bench);
    results.push(result.bench);
  }

  const daily: BenchResult[] = [];
  for (let index = 0; index < 5; index += 1) {
    const result = await request(`daily-warm-${index + 1}`, primary, '/api/daily-quest/today');
    daily.push(result.bench);
    results.push(result.bench);
  }

  const stats = await request('stats', primary, '/api/profile/stats', {
    method: 'PATCH',
    body: JSON.stringify({ stats: profile.stats }),
  });
  results.push(stats.bench);
  assertTiming(stats.bench, ['auth', 'db_wait', 'db_query', 'db_tx', 'hydrate']);

  const coins = await request('coins', primary, '/api/profile/coins', {
    method: 'POST',
    body: JSON.stringify({ amount: 0 }),
  });
  results.push(coins.bench);
  assertTiming(coins.bench, ['auth', 'db_wait', 'db_query', 'db_tx', 'hydrate']);

  const gameResult = await request('game-result', primary, '/api/profile/game-result', {
    method: 'POST',
    body: JSON.stringify({ stats: profile.stats, pet: profile.pet, coinsDelta: 0, analyticsEvents: [], gameEvents: [] }),
  });
  results.push(gameResult.bench);
  assertTiming(gameResult.bench, ['auth', 'db_wait', 'db_query', 'db_tx', 'hydrate']);

  const events = Array.from({ length: 20 }, (_, index) => ({
    eventKey: `perf:${primary.id}:${Date.now()}:${index}`,
    eventType: index % 2 ? 'word_mastered' : 'word_failed',
    gameMode: 'anagram',
    word: `WORD${index}`,
    result: index % 2 ? 'mastered' : 'failed',
    payload: { source: 'api-performance-benchmark' },
  }));
  const gameEvents = await request('game-events-batch', primary, '/api/game-events/events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
  results.push(gameEvents.bench);
  assertTiming(gameEvents.bench, ['auth', 'db_wait', 'db_query']);

  const concurrentStartedAt = performance.now();
  const concurrent = await Promise.all(users.map((user, index) => request(`coins-concurrent-${index + 1}`, user, '/api/profile/coins', {
    method: 'POST',
    body: JSON.stringify({ amount: 0 }),
  })));
  const concurrentWallMs = Math.round((performance.now() - concurrentStartedAt) * 10) / 10;
  results.push(...concurrent.map(item => item.bench));

  const warmP95 = percentile(warmBootstrap.map(item => item.durationMs), 0.95);
  const dailyP95 = percentile(daily.map(item => item.durationMs), 0.95);
  const concurrentP95 = percentile(concurrent.map(item => item.bench.durationMs), 0.95);

  const report = {
    coldBootstrapMs: coldBootstrap.bench.durationMs,
    warmBootstrapP50Ms: percentile(warmBootstrap.map(item => item.durationMs), 0.5),
    warmBootstrapP95Ms: warmP95,
    dailyQuestP95Ms: dailyP95,
    statsMs: stats.bench.durationMs,
    coinsMs: coins.bench.durationMs,
    gameResultMs: gameResult.bench.durationMs,
    gameEventsBatchMs: gameEvents.bench.durationMs,
    concurrentEightCoinsWallMs: concurrentWallMs,
    concurrentEightCoinsP95Ms: concurrentP95,
    requests: results.length,
  };
  console.log(`API_PERFORMANCE_REPORT ${JSON.stringify(report)}`);

  if (coldBootstrap.bench.durationMs > 3000) throw new Error(`Cold bootstrap too slow: ${coldBootstrap.bench.durationMs}ms`);
  if (warmP95 > 800) throw new Error(`Warm bootstrap p95 too slow: ${warmP95}ms`);
  if (dailyP95 > 800) throw new Error(`Daily quest p95 too slow: ${dailyP95}ms`);
  if (stats.bench.durationMs > 1200 || coins.bench.durationMs > 1200 || gameResult.bench.durationMs > 1500) throw new Error('Hot profile mutation exceeded benchmark threshold');
  if (gameEvents.bench.durationMs > 1200) throw new Error(`Game event batch too slow: ${gameEvents.bench.durationMs}ms`);
  if (concurrentP95 > 2000 || concurrentWallMs > 2500) throw new Error(`Concurrent profile requests show pool starvation: p95=${concurrentP95} wall=${concurrentWallMs}`);
}

async function runSecuritySmoke(users: SeedUser[]): Promise<void> {
  const parent = users[0];
  const teacherA = users[1];
  const teacherB = users[2];

  await pool.query("update profiles set role = 'parent', account_mode = 'parent' where id = $1", [parent.id]);
  await pool.query("update profiles set role = 'teacher', account_mode = 'teacher' where id = any($1::uuid[])", [[teacherA.id, teacherB.id]]);
  // Avoid a real Postbox call in the local integration environment. The production path is
  // still exercised up to the notification branch, but an empty DB email skips delivery.
  await pool.query("update app_users set email = '' where id = $1", [parent.id]);

  const inviteCode = 'ABC234';
  const inviteCodeHash = createHash('sha256').update(inviteCode).digest('hex');
  await pool.query(
    "insert into teacher_connection_invites (learner_user_id, code_hash, expires_at) values ($1, $2, now() + interval '1 hour')",
    [parent.id, inviteCodeHash],
  );

  const firstConnect = await rawRequest(teacherA, '/api/mentor/connect', {
    method: 'POST',
    body: JSON.stringify({ code: inviteCode }),
  });
  if (firstConnect.status !== 200) throw new Error(`First teacher invite use failed: ${firstConnect.status} ${JSON.stringify(firstConnect.body)}`);

  const reusedConnect = await rawRequest(teacherB, '/api/mentor/connect', {
    method: 'POST',
    body: JSON.stringify({ code: inviteCode }),
  });
  if (reusedConnect.status !== 404 || reusedConnect.body?.code !== 'learner_invite_unavailable') {
    throw new Error(`One-time invite was reusable: ${reusedConnect.status} ${JSON.stringify(reusedConnect.body)}`);
  }

  const beforeRevoke = await rawRequest(teacherA, '/api/mentor/learners');
  if (beforeRevoke.status !== 200 || !Array.isArray(beforeRevoke.body?.learners) || beforeRevoke.body.learners.length !== 1) {
    throw new Error(`Connected teacher cannot read expected learner: ${beforeRevoke.status} ${JSON.stringify(beforeRevoke.body)}`);
  }

  await pool.query(
    "update adult_learner_links set revoked_at = now() where adult_user_id = $1 and learner_user_id = $2 and relation_role = 'teacher'",
    [teacherA.id, parent.id],
  );

  const afterRevoke = await rawRequest(teacherA, '/api/mentor/learners');
  if (afterRevoke.status !== 200 || !Array.isArray(afterRevoke.body?.learners) || afterRevoke.body.learners.length !== 0) {
    throw new Error(`Revoked teacher can still read learner data: ${afterRevoke.status} ${JSON.stringify(afterRevoke.body)}`);
  }
  const assignAfterRevoke = await rawRequest(teacherA, '/api/mentor/assign', {
    method: 'POST',
    body: JSON.stringify({ learnerId: parent.id, collectionId: 'does-not-matter' }),
  });
  if (assignAfterRevoke.status !== 403 || assignAfterRevoke.body?.code !== 'learner_unavailable') {
    throw new Error(`Revoked teacher can still assign dictionary: ${assignAfterRevoke.status} ${JSON.stringify(assignAfterRevoke.body)}`);
  }

  await pool.query("update app_users set password_hash = 'changed-parent-password' where id = $1", [parent.id]);
  await pool.query("update app_users set password_hash = 'changed-teacher-password' where id = $1", [teacherA.id]);

  const revokedParentSession = await rawRequest(parent, '/api/profile/bootstrap');
  if (revokedParentSession.status !== 401 || revokedParentSession.body?.code !== 'session_revoked') {
    throw new Error(`Parent session survived password change: ${revokedParentSession.status} ${JSON.stringify(revokedParentSession.body)}`);
  }
  const revokedTeacherSession = await rawRequest(teacherA, '/api/mentor/learners');
  if (revokedTeacherSession.status !== 401 || revokedTeacherSession.body?.code !== 'session_revoked') {
    throw new Error(`Teacher session survived password change: ${revokedTeacherSession.status} ${JSON.stringify(revokedTeacherSession.body)}`);
  }

  console.log('SECURITY_INTEGRATION_REPORT {"sessionRevocation":"ok","oneTimeTeacherInvite":"ok","teacherRevocation":"ok"}');
}

async function main(): Promise<void> {
  await resetDatabase();
  const users = await seedUsers();
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/yandex-api.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(apiPort),
      DATABASE_URL: databaseUrl,
      PGSSL: 'disable',
      PGPOOL_MAX: '8',
      PGPOOL_CONNECTION_TIMEOUT_MS: '2000',
      DB_SLOW_QUERY_MS: '300',
      DB_SLOW_POOL_WAIT_MS: '100',
      AUTH_USER_CACHE_TTL_MS: '120000',
      JWT_SECRET: jwtSecret,
      SESSION_SECRET: 'benchmark-session-secret',
      COOKIE_SECRET: 'benchmark-cookie-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', chunk => process.stdout.write(`[api] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[api] ${chunk}`));

  try {
    await waitForApi(child);
    await runBenchmark(users);
    await runSecuritySmoke(users);
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 250));
    if (child.exitCode === null) child.kill('SIGKILL');
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});