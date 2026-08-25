import { createHmac } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/annword_perf';
const jwtSecret = process.env.JWT_SECRET || 'annword-api-performance-benchmark-secret';
const apiPort = Number(process.env.ACTIVE_SOURCE_SMOKE_PORT || 8091);
const apiBase = `http://127.0.0.1:${apiPort}`;
const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 2 });

const signSession = (userId: string, email: string, version = 1): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: userId, email, ver: version, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${body}`;
  const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

async function waitForApi(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited before active-source smoke with code ${child.exitCode}`);
    try {
      const response = await fetch(`${apiBase}/api/health`);
      if (response.ok) return;
    } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('API did not become healthy within 15s');
}

async function jsonRequest(token: string, endpoint: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-AnnWord-Session': token,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${endpoint} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function main(): Promise<void> {
  const userResult = await pool.query<{ id: string; email: string; session_version: number }>(
    "select id, email, session_version from app_users where email = 'perf-3@annword.test' limit 1",
  );
  const user = userResult.rows[0];
  if (!user) throw new Error('Benchmark seed user perf-3 is missing. Run api-performance-benchmark first.');
  await pool.query(
    "update profiles set subscription_tier = 'premium', premium_expires_at = now() + interval '1 day' where id = $1",
    [user.id],
  );
  const token = signSession(user.id, user.email, user.session_version);
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/yandex-api.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(apiPort),
      DATABASE_URL: databaseUrl,
      PGSSL: 'disable',
      JWT_SECRET: jwtSecret,
      SESSION_SECRET: 'active-source-smoke-session-secret',
      COOKIE_SECRET: 'active-source-smoke-cookie-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', chunk => process.stdout.write(`[active-source-api] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[active-source-api] ${chunk}`));

  try {
    await waitForApi(child);
    const savedAnimals = await jsonRequest(token, '/api/profile/active-word-source', {
      method: 'PATCH',
      body: JSON.stringify({ activeWordSource: { source: 'premium', difficulty: 'ALL', premiumDictionaryId: 'kids_animals' } }),
    });
    if (savedAnimals.profile?.activeWordSource?.premiumDictionaryId !== 'kids_animals' || !savedAnimals.profile?.activeWordSource?.updatedAt) {
      throw new Error(`Animals selection was not persisted: ${JSON.stringify(savedAnimals)}`);
    }

    const reloadAnimals = await jsonRequest(token, '/api/profile/bootstrap');
    if (reloadAnimals.profile?.activeWordSource?.source !== 'premium' || reloadAnimals.profile?.activeWordSource?.premiumDictionaryId !== 'kids_animals') {
      throw new Error(`Animals selection did not survive bootstrap reload: ${JSON.stringify(reloadAnimals.profile?.activeWordSource)}`);
    }

    await jsonRequest(token, '/api/profile/active-word-source', {
      method: 'PATCH',
      body: JSON.stringify({ activeWordSource: { source: 'custom', difficulty: 'ALL' } }),
    });
    const reloadCustom = await jsonRequest(token, '/api/profile/bootstrap');
    if (reloadCustom.profile?.activeWordSource?.source !== 'custom') {
      throw new Error(`Custom selection did not survive bootstrap reload: ${JSON.stringify(reloadCustom.profile?.activeWordSource)}`);
    }

    console.log('ACTIVE_WORD_SOURCE_INTEGRATION_REPORT {"animalsReload":"ok","customReload":"ok"}');
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
