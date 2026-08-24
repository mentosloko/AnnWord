import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { closeDatabasePool, query, requirePool, transaction } from "../server/db";

const migrationsDir = path.resolve(process.cwd(), "db", "yandex");
const historicalMigrationPattern = /^\d{3}_.+\.sql$/;
const MIGRATION_ADVISORY_LOCK_ID = "7643829012456712";

async function baselineExistingProductionSchema(files: string[], appliedVersions: Set<string>): Promise<void> {
  const schema = await query<{ has_app_users: boolean; has_profiles: boolean }>(`
    select
      to_regclass('public.app_users') is not null as has_app_users,
      to_regclass('public.profiles') is not null as has_profiles
  `);
  const existing = schema.rows[0];
  if (!existing?.has_app_users || !existing?.has_profiles) return;

  const users = await query<{ has_existing_users: boolean }>(
    "select exists (select 1 from public.app_users limit 1) as has_existing_users",
  );
  if (users.rows[0]?.has_existing_users !== true) return;

  const historical = files.filter(
    (file) => historicalMigrationPattern.test(file) && !appliedVersions.has(file),
  );
  if (!historical.length) return;

  await transaction(async (client) => {
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
  });

  console.log(`Existing Yandex schema baselined with ${historical.length} historical migration(s).`);
}

async function withMigrationLock<T>(operation: () => Promise<T>): Promise<T> {
  const client = await requirePool().connect();
  try {
    await client.query("select pg_advisory_lock($1::bigint)", [MIGRATION_ADVISORY_LOCK_ID]);
    return await operation();
  } finally {
    await client.query("select pg_advisory_unlock($1::bigint)", [MIGRATION_ADVISORY_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log("No Yandex PostgreSQL migrations found.");
    return;
  }

  await query(`
    create table if not exists public.annword_schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = await query<{ version: string }>("select version from public.annword_schema_migrations");
  const appliedVersions = new Set(applied.rows.map((row) => row.version));

  await baselineExistingProductionSchema(files, appliedVersions);

  for (const file of files) {
    if (appliedVersions.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);

    await transaction(async (client) => {
      await client.query(sql);
      await client.query(
        `insert into public.annword_schema_migrations(version)
         values ($1)
         on conflict (version) do nothing`,
        [file],
      );
    });
    appliedVersions.add(file);
  }

  console.log("Yandex PostgreSQL migrations applied.");
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("Yandex PostgreSQL migrations are deferred to backend container startup because Managed PostgreSQL is private.");
    return;
  }

  await withMigrationLock(runMigrations);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabasePool();
  });
