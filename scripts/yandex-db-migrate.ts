import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { closeDatabasePool, query, transaction } from "../server/db";

const migrationsDir = path.resolve(process.cwd(), "db", "yandex");

async function main(): Promise<void> {
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

  for (const file of files) {
    if (appliedVersions.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);

    await transaction(async (client) => {
      await client.query(sql);
      await client.query("insert into public.annword_schema_migrations(version) values ($1)", [file]);
    });
  }

  console.log("Yandex PostgreSQL migrations applied.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabasePool();
  });
