import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { transaction } from "./db";

const migrationsDir = path.resolve(process.cwd(), "db", "yandex");
const historicalMigrationPattern = /^\d{3}_.+\.sql$/;
const migrationLockKey = "annword-yandex-schema-migrations-v1";

export async function runYandexSchemaMigrations(): Promise<void> {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log("No Yandex PostgreSQL migrations found.");
    return;
  }

  await transaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [migrationLockKey]);
    await client.query(`
      create table if not exists public.annword_schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedResult = await client.query<{ version: string }>(
      "select version from public.annword_schema_migrations",
    );
    const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));

    const schemaResult = await client.query<{ has_app_users: boolean; has_profiles: boolean }>(`
      select
        to_regclass('public.app_users') is not null as has_app_users,
        to_regclass('public.profiles') is not null as has_profiles
    `);
    const schema = schemaResult.rows[0];
    let hasExistingUsers = false;
    if (schema?.has_app_users && schema.has_profiles) {
      const usersResult = await client.query<{ has_existing_users: boolean }>(
        "select exists (select 1 from public.app_users limit 1) as has_existing_users",
      );
      hasExistingUsers = usersResult.rows[0]?.has_existing_users === true;
    }

    if (hasExistingUsers) {
      const missingHistorical = files.filter(
        (file) => historicalMigrationPattern.test(file) && !appliedVersions.has(file),
      );
      for (const file of missingHistorical) {
        await client.query(
          `insert into public.annword_schema_migrations(version)
           values ($1)
           on conflict (version) do nothing`,
          [file],
        );
        appliedVersions.add(file);
        console.log(`baseline ${file}`);
      }
      if (missingHistorical.length) {
        console.log(`Existing Yandex schema baselined with ${missingHistorical.length} historical migration(s).`);
      }
    }

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query(sql);
      await client.query(
        `insert into public.annword_schema_migrations(version)
         values ($1)
         on conflict (version) do nothing`,
        [file],
      );
      appliedVersions.add(file);
    }
  });

  console.log("Yandex PostgreSQL migrations applied inside backend startup.");
}
