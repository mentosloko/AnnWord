import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { closeDatabasePool, query, requirePool } from "../server/db";

const migrationsDir = path.resolve(process.cwd(), "db", "yandex");
const historicalMigrationPattern = /^\d{3}_.+\.sql$/;
const MIGRATION_ADVISORY_LOCK_ID = "7643829012456712";
const MIGRATION_WAIT_ATTEMPTS = 60;
const MIGRATION_WAIT_MS = 250;

const sleep = (durationMs: number): Promise<void> => new Promise(resolve => setTimeout(resolve, durationMs));
const errorCode = (error: unknown): string | undefined => (error as { code?: string } | null)?.code;

async function listMigrationFiles(): Promise<string[]> {
  return (await readdir(migrationsDir))
    .filter(file => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function readAppliedVersions(): Promise<Set<string> | null> {
  try {
    const applied = await query<{ version: string }>("select version from public.annword_schema_migrations");
    return new Set(applied.rows.map(row => row.version));
  } catch (error) {
    if (errorCode(error) === "42P01") return null;
    throw error;
  }
}

async function hasPendingMigrations(files: string[]): Promise<boolean> {
  if (!files.length) return false;
  const appliedVersions = await readAppliedVersions();
  if (!appliedVersions) return true;
  return files.some(file => !appliedVersions.has(file));
}

async function baselineExistingProductionSchema(client: PoolClient, files: string[], appliedVersions: Set<string>): Promise<void> {
  const schema = await client.query<{ has_app_users: boolean; has_profiles: boolean }>(`
    select
      to_regclass('public.app_users') is not null as has_app_users,
      to_regclass('public.profiles') is not null as has_profiles
  `);
  const existing = schema.rows[0];
  if (!existing?.has_app_users || !existing?.has_profiles) return;

  const users = await client.query<{ has_existing_users: boolean }>(
    "select exists (select 1 from public.app_users limit 1) as has_existing_users",
  );
  if (users.rows[0]?.has_existing_users !== true) return;

  const historical = files.filter(
    file => historicalMigrationPattern.test(file) && !appliedVersions.has(file),
  );
  if (!historical.length) return;

  await client.query("begin");
  try {
    for (const file of historical) {
      await client.query(
        `insert into public.annword_schema_migrations(version)
         values ($1)
         on conflict (version) do nothing`,
        [file],
      );
      appliedVersions.add(file);
      console.log(`baseline ${file}`);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }

  console.log(`Existing Yandex schema baselined with ${historical.length} historical migration(s).`);
}

async function applyMigrationsWithLock(client: PoolClient, files: string[]): Promise<void> {
  await client.query(`
    create table if not exists public.annword_schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = await client.query<{ version: string }>("select version from public.annword_schema_migrations");
  const appliedVersions = new Set(applied.rows.map(row => row.version));
  await baselineExistingProductionSchema(client, files, appliedVersions);

  for (const file of files) {
    if (appliedVersions.has(file)) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        `insert into public.annword_schema_migrations(version)
         values ($1)
         on conflict (version) do nothing`,
        [file],
      );
      await client.query("commit");
      appliedVersions.add(file);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  }

  console.log("Yandex PostgreSQL migrations applied.");
}

async function hasPendingMigrationsOnClient(client: PoolClient, files: string[]): Promise<boolean> {
  try {
    const applied = await client.query<{ version: string }>("select version from public.annword_schema_migrations");
    const appliedVersions = new Set(applied.rows.map(row => row.version));
    return files.some(file => !appliedVersions.has(file));
  } catch (error) {
    if (errorCode(error) === "42P01") return true;
    throw error;
  }
}

async function runMigrationsIfNeeded(): Promise<void> {
  const files = await listMigrationFiles();
  if (!files.length) {
    console.log("No Yandex PostgreSQL migrations found.");
    return;
  }

  // Normal serverless cold starts take this fast path and never enter the migration lock.
  if (!(await hasPendingMigrations(files))) {
    console.log("Yandex PostgreSQL migrations already current.");
    return;
  }

  for (let attempt = 0; attempt < MIGRATION_WAIT_ATTEMPTS; attempt += 1) {
    if (!(await hasPendingMigrations(files))) {
      console.log("Yandex PostgreSQL migrations completed by another container.");
      return;
    }

    const client = await requirePool().connect();
    let acquired = false;
    try {
      const result = await client.query<{ acquired: boolean }>(
        "select pg_try_advisory_lock($1::bigint) as acquired",
        [MIGRATION_ADVISORY_LOCK_ID],
      );
      acquired = result.rows[0]?.acquired === true;
      if (acquired) {
        // Re-check after acquiring the lock because another instance may have finished first.
        if (await hasPendingMigrationsOnClient(client, files)) {
          await applyMigrationsWithLock(client, files);
        }
        return;
      }
    } finally {
      if (acquired) {
        await client.query("select pg_advisory_unlock($1::bigint)", [MIGRATION_ADVISORY_LOCK_ID]).catch(() => undefined);
      }
      client.release();
    }

    // Do not hold a database connection while another container applies the migration.
    await sleep(MIGRATION_WAIT_MS);
  }

  throw new Error("Timed out waiting for Yandex PostgreSQL migrations to complete");
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("Yandex PostgreSQL migrations are deferred to backend container startup because Managed PostgreSQL is private.");
    return;
  }

  await runMigrationsIfNeeded();
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabasePool();
  });
